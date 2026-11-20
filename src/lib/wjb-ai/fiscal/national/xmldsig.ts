import {
  createHash,
  sign as rsaSign,
  verify as rsaVerify,
  X509Certificate,
  type KeyObject,
} from "node:crypto";

import {
  canonicalize,
  childElements,
  defaultNamespace,
  findById,
  parseXml,
  textOf,
  type XmlElement,
} from "@/lib/wjb-ai/fiscal/national/xml-c14n";

/**
 * Assinatura XMLDSig da DPS conforme o padrão do Sistema Nacional NFS-e
 * (Manual Integrado v1.00.02, item 6.1.4, publicado em "leiaute e esquemas
 * antigos" do gov.br/nfse; nenhum documento atual o substitui):
 *   enveloped, sobre infDPS identificado pelo Id, Reference URI="#<Id>";
 *   CanonicalizationMethod e Transform C14N 20010315 (inclusivo);
 *   exatamente 2 Transforms: enveloped-signature + C14N;
 *   SignatureMethod rsa-sha1; DigestMethod sha1;
 *   KeyInfo/X509Data/X509Certificate só com o certificado do titular
 *   (EndCertOnly); sem X509SubjectName/IssuerSerial/SKI e sem KeyValue;
 *   namespace da assinatura declarado na própria tag Signature, sem prefixo.
 *
 * SHA-256 fica disponível como opção explícita porque o documento é de 2022;
 * o padrão segue o documento oficial até o swagger/manual vigente ser lido
 * com certificado (doc 29).
 */
export const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
export const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
export const ENVELOPED =
  "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

export const SIGNATURE_PROFILES = {
  "rsa-sha1": {
    signature: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    digest: "http://www.w3.org/2000/09/xmldsig#sha1",
    hash: "sha1",
    official: true,
  },
  "rsa-sha256": {
    signature: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    digest: "http://www.w3.org/2001/04/xmlenc#sha256",
    hash: "sha256",
    official: false,
  },
} as const;
export type SignatureProfile = keyof typeof SIGNATURE_PROFILES;
export const OFFICIAL_SIGNATURE_PROFILE: SignatureProfile = "rsa-sha1";

export interface SigningMaterial {
  privateKey: KeyObject;
  /** Certificado X.509 do titular em DER (só o do usuário final). */
  certificateDer: Buffer;
}

const isSignature = (e: XmlElement) =>
  e.name === "Signature" && defaultNamespace(e) === DSIG_NS;

function signedInfoXml(
  refId: string,
  digestValue: string,
  profile: SignatureProfile,
) {
  const p = SIGNATURE_PROFILES[profile];
  return (
    `<SignedInfo>` +
    `<CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${p.signature}"></SignatureMethod>` +
    `<Reference URI="#${refId}"><Transforms>` +
    `<Transform Algorithm="${ENVELOPED}"></Transform>` +
    `<Transform Algorithm="${C14N}"></Transform>` +
    `</Transforms><DigestMethod Algorithm="${p.digest}"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`
  );
}

/** Assina o elemento com o `Id` informado e insere o Signature logo depois dele. */
export function signXml(
  xml: string,
  refId: string,
  material: SigningMaterial,
  profile: SignatureProfile = OFFICIAL_SIGNATURE_PROFILE,
): string {
  if (xml.includes("<Signature")) throw new Error("XML já assinado.");
  const p = SIGNATURE_PROFILES[profile];
  const root = parseXml(xml);
  const target = findById(root, refId);
  if (!target) throw new Error("Elemento a assinar não encontrado.");
  const digest = createHash(p.hash)
    .update(canonicalize(target, isSignature), "utf8")
    .digest("base64");

  // SignedInfo dentro de um Signature com o namespace dsig, para canonicalizar
  // exatamente como o verificador fará (namespace herdado do Signature).
  const si = signedInfoXml(refId, digest, profile);
  const siRoot = parseXml(`<Signature xmlns="${DSIG_NS}">${si}</Signature>`);
  const siCanonical = canonicalize(childElements(siRoot, "SignedInfo")[0]);
  const value = rsaSign(
    p.hash,
    Buffer.from(siCanonical, "utf8"),
    material.privateKey,
  ).toString("base64");
  const cert = material.certificateDer.toString("base64");
  const signature =
    `<Signature xmlns="${DSIG_NS}">${si}<SignatureValue>${value}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert}</X509Certificate></X509Data></KeyInfo></Signature>`;
  const close = `</${target.name}>`;
  const at = xml.indexOf(close, xml.indexOf(`Id="${refId}"`));
  if (at < 0)
    throw new Error("Fechamento do elemento assinado não encontrado.");
  return (
    xml.slice(0, at + close.length) + signature + xml.slice(at + close.length)
  );
}

export interface SignatureCheck {
  valid: boolean;
  /** Código de rejeição equivalente do Anexo I, quando inválida. */
  code?: "E0714" | "E0717";
  reason?: string;
  profile?: SignatureProfile;
  certificateDer?: Buffer;
}

const fail = (code: "E0714" | "E0717", reason: string): SignatureCheck => ({
  valid: false,
  code,
  reason,
});

/**
 * Verificação criptográfica e de conformidade com o padrão do Sistema
 * Nacional: recalcula o digest do elemento referenciado, canonicaliza o
 * SignedInfo e confere a assinatura RSA com a chave pública do certificado
 * do KeyInfo. Não confere cadeia ICP-Brasil nem LCR (isso é da SEFIN).
 */
export function verifyXmlSignature(signedXml: string): SignatureCheck {
  let root: XmlElement;
  try {
    root = parseXml(signedXml);
  } catch (e) {
    return fail("E0714", `XML inválido: ${(e as Error).message}`);
  }
  const sigs: XmlElement[] = [];
  const stack = [root];
  while (stack.length) {
    const e = stack.pop()!;
    if (isSignature(e)) sigs.push(e);
    for (const c of childElements(e)) stack.push(c);
  }
  if (sigs.length === 0) return fail("E0717", "Assinatura ausente.");
  if (sigs.length > 1) return fail("E0714", "Mais de uma assinatura.");
  const sig = sigs[0];
  if (sig.attrs.find(([k]) => k === "xmlns")?.[1] !== DSIG_NS)
    return fail(
      "E0714",
      "Namespace da assinatura deve ser declarado na tag Signature.",
    );
  const [si] = childElements(sig, "SignedInfo");
  const [sv] = childElements(sig, "SignatureValue");
  const [ki] = childElements(sig, "KeyInfo");
  if (!si || !sv || !ki)
    return fail("E0714", "Estrutura da assinatura incompleta.");

  const cm = childElements(si, "CanonicalizationMethod")[0]?.attrs.find(
    ([k]) => k === "Algorithm",
  )?.[1];
  const sm = childElements(si, "SignatureMethod")[0]?.attrs.find(
    ([k]) => k === "Algorithm",
  )?.[1];
  const profile = (Object.keys(SIGNATURE_PROFILES) as SignatureProfile[]).find(
    (k) => SIGNATURE_PROFILES[k].signature === sm,
  );
  if (cm !== C14N)
    return fail("E0714", "Canonicalização diferente de C14N 20010315.");
  if (!profile) return fail("E0714", "Algoritmo de assinatura não suportado.");
  const refs = childElements(si, "Reference");
  if (refs.length !== 1)
    return fail("E0714", "Deve haver exatamente uma Reference.");
  const ref = refs[0];
  const uri = ref.attrs.find(([k]) => k === "URI")?.[1] ?? "";
  const transforms = childElements(
    childElements(ref, "Transforms")[0] ?? ref,
    "Transform",
  ).map((t) => t.attrs.find(([k]) => k === "Algorithm")?.[1]);
  if (
    transforms.length !== 2 ||
    transforms[0] !== ENVELOPED ||
    transforms[1] !== C14N
  )
    return fail(
      "E0714",
      "Transforms devem ser exatamente enveloped-signature e C14N.",
    );
  const dm = childElements(ref, "DigestMethod")[0]?.attrs.find(
    ([k]) => k === "Algorithm",
  )?.[1];
  if (dm !== SIGNATURE_PROFILES[profile].digest)
    return fail("E0714", "DigestMethod incompatível com o SignatureMethod.");
  const x509 = childElements(ki, "X509Data");
  const forbidden = [
    "KeyValue",
    "X509SubjectName",
    "X509IssuerSerial",
    "X509SKI",
  ];
  const kiNames = [
    ...childElements(ki),
    ...x509.flatMap((x) => childElements(x)),
  ].map((e) => e.name);
  if (kiNames.some((n) => forbidden.includes(n)))
    return fail(
      "E0714",
      "KeyInfo com elementos não permitidos pelo Sistema Nacional.",
    );
  const certs = x509.flatMap((x) => childElements(x, "X509Certificate"));
  if (certs.length !== 1)
    return fail("E0714", "KeyInfo deve ter só o certificado do titular.");

  if (!uri.startsWith("#")) return fail("E0714", "Reference URI inválida.");
  const target = findById(root, uri.slice(1));
  if (!target) return fail("E0714", "Elemento referenciado não encontrado.");
  const digest = createHash(SIGNATURE_PROFILES[profile].hash)
    .update(canonicalize(target, isSignature), "utf8")
    .digest("base64");
  if (digest !== textOf(childElements(ref, "DigestValue")[0] ?? ref).trim())
    return fail("E0714", "DigestValue não confere (conteúdo alterado).");

  let certificateDer: Buffer;
  try {
    certificateDer = Buffer.from(
      textOf(certs[0]).replace(/\s+/g, ""),
      "base64",
    );
    new X509Certificate(certificateDer);
  } catch {
    return fail("E0714", "Certificado do KeyInfo ilegível.");
  }
  const ok = rsaVerify(
    SIGNATURE_PROFILES[profile].hash,
    Buffer.from(canonicalize(si), "utf8"),
    new X509Certificate(certificateDer).publicKey,
    Buffer.from(textOf(sv).replace(/\s+/g, ""), "base64"),
  );
  if (!ok)
    return fail("E0714", "SignatureValue não confere com o certificado.");
  return { valid: true, profile, certificateDer };
}
