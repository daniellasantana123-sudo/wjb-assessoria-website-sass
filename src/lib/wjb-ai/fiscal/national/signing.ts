import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura da DPS (Fase 5).
 *
 * O que é oficial (FAQ NFS-e v1.4, 18/11/2026, 17.1/17.2/17.7 e XSD v1.01):
 * - XMLDSig no padrão ENVELOPED, na tag que tem o atributo Id (infDPS);
 *   `ds:Signature` vem logo depois de `infDPS` dentro de `DPS`.
 * - Certificado ICP-Brasil v3, A1 ou A3, OtherName 2.16.76.1.3.3 (CNPJ),
 *   KeyUsage "Assinatura Digital" + "Não Recusa", uso "Autenticação de
 *   Cliente", Basic Constraint = false.
 * - Titular do certificado = emitente da DPS, ou titular com procuração
 *   eletrônica vigente / representação legal (senão E0718).
 *
 * O que NÃO está confirmado em fonte oficial pública: algoritmo de assinatura
 * e de digest e a canonicalização exigidos pela SEFIN. Por isso o algoritmo
 * é parâmetro e fica marcado como pendente até a leitura do swagger/manual
 * com certificado.
 *
 * Nesta fase só existe o assinador SIMULADO: ele produz um bloco
 * estruturalmente válido no XSD, com um valor que nunca passa por assinatura
 * real (prefixo SIMULADO). O assinador ICP-Brasil fica bloqueado.
 */
export const SIGNATURE_ALGORITHM_PENDING = {
  canonicalization: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  signature: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  digest: "http://www.w3.org/2001/04/xmlenc#sha256",
  confirmed: false,
} as const;

export interface DpsSigner {
  readonly simulated: boolean;
  /** Devolve o XML com `ds:Signature` enveloped referenciando `#refId`. */
  sign(xml: string, refId: string): Promise<string>;
}

export class SignerNotAvailableError extends Error {
  constructor() {
    super(
      "Assinatura ICP-Brasil indisponível nesta fase (sem certificado, sem cofre e sem autorização da WJB).",
    );
    this.name = "SignerNotAvailableError";
  }
}

function infDpsFragment(xml: string): string {
  const m = xml.match(/<infDPS\b[\s\S]*<\/infDPS>/);
  if (!m) throw new Error("XML sem infDPS.");
  return m[0];
}

/**
 * Assinador simulado. A "chave" é fixa e pública (só de teste): o objetivo é
 * exercitar o fluxo, a posição do bloco e a detecção de adulteração, nunca
 * produzir algo aceitável pelo governo.
 */
export class SimulatedDpsSigner implements DpsSigner {
  readonly simulated = true;
  private static readonly KEY = "wjb-ai-assinatura-simulada";

  async sign(xml: string, refId: string): Promise<string> {
    if (xml.includes("<Signature")) throw new Error("XML já assinado.");
    const digest = createHash("sha256")
      .update(infDpsFragment(xml))
      .digest("base64");
    const value = Buffer.from(
      "SIMULADO:" +
        createHmac("sha256", SimulatedDpsSigner.KEY)
          .update(digest)
          .digest("hex"),
    ).toString("base64");
    const a = SIGNATURE_ALGORITHM_PENDING;
    const signature =
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>` +
      `<CanonicalizationMethod Algorithm="${a.canonicalization}"/>` +
      `<SignatureMethod Algorithm="${a.signature}"/>` +
      `<Reference URI="#${refId}"><Transforms>` +
      `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
      `<Transform Algorithm="${a.canonicalization}"/></Transforms>` +
      `<DigestMethod Algorithm="${a.digest}"/><DigestValue>${digest}</DigestValue>` +
      `</Reference></SignedInfo><SignatureValue>${value}</SignatureValue></Signature>`;
    return xml.replace("</infDPS>", `</infDPS>${signature}`);
  }

  /** Confere o bloco simulado (adulteração do infDPS invalida). */
  static verify(signedXml: string): boolean {
    const digest = signedXml.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1];
    const value = signedXml.match(
      /<SignatureValue>([^<]+)<\/SignatureValue>/,
    )?.[1];
    if (!digest || !value) return false;
    const actual = createHash("sha256")
      .update(infDpsFragment(signedXml))
      .digest("base64");
    const expected = Buffer.from(
      "SIMULADO:" +
        createHmac("sha256", SimulatedDpsSigner.KEY)
          .update(actual)
          .digest("hex"),
    ).toString("base64");
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return digest === actual && a.length === b.length && timingSafeEqual(a, b);
  }
}

/** Assinador real: só depois do cofre, do certificado e da autorização da WJB. */
export function createIcpBrasilSigner(): DpsSigner {
  throw new SignerNotAvailableError();
}
