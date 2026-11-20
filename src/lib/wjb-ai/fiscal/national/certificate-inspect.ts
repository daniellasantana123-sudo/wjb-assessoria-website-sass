import { X509Certificate } from "node:crypto";

import type { CertificateMetadata } from "@/lib/wjb-ai/fiscal/emitter-authorization";

/**
 * Leitura dos dados do certificado que o Sistema Nacional NFS-e confere
 * (Manual Integrado 6.1.3; Anexo I v1.01, RN_RECEPCAO_DPS 2-8 e regras
 * E0715/E0716 da assinatura). Lê só a parte PÚBLICA (o X.509). A chave
 * privada nunca passa por aqui.
 *
 * O Node não decodifica o OtherName (CNPJ/CPF ICP-Brasil) nem os bits de
 * Key Usage, então há um leitor DER mínimo, restrito a essas extensões.
 */
const OID_SAN = Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x11]);
const OID_KEY_USAGE = Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x0f]);
const OID_CNPJ = "2.16.76.1.3.3";
const OID_CPF_DADOS = "2.16.76.1.3.1";
const EKU_CLIENT_AUTH = "1.3.6.1.5.5.7.3.2";

interface Tlv {
  tag: number;
  start: number; // início do valor
  end: number; // fim do valor
  next: number; // próximo TLV irmão
}

function readTlv(buf: Buffer, pos: number): Tlv {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let start = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error("DER: comprimento inválido.");
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + buf[pos + 2 + k];
    start = pos + 2 + n;
  }
  const end = start + len;
  if (end > buf.length) throw new Error("DER: estrutura truncada.");
  return { tag, start, end, next: end };
}

function children(buf: Buffer, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = t.start; p < t.end;) {
    const c = readTlv(buf, p);
    out.push(c);
    p = c.next;
  }
  return out;
}

function decodeOid(bytes: Buffer): string {
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let v = 0;
  for (let k = 1; k < bytes.length; k++) {
    v = v * 128 + (bytes[k] & 0x7f);
    if (!(bytes[k] & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

/** Valor (OCTET STRING) da extensão cujo OID vem logo antes no DER. */
function extensionValue(der: Buffer, oid: Buffer): Buffer | null {
  const at = der.indexOf(oid);
  if (at < 0) return null;
  let p = at + oid.length;
  let t = readTlv(der, p);
  if (t.tag === 0x01) {
    p = t.next; // critical BOOLEAN
    t = readTlv(der, p);
  }
  if (t.tag !== 0x04) return null;
  return der.subarray(t.start, t.end);
}

function stringValue(buf: Buffer, t: Tlv): string {
  // [0] EXPLICIT { OCTET STRING | UTF8String | PrintableString | IA5String }
  const inner = t.tag === 0xa0 ? readTlv(buf, t.start) : t;
  return buf.subarray(inner.start, inner.end).toString("latin1");
}

export interface IcpIdentity {
  cnpj: string | null;
  cpf: string | null;
}

/** CNPJ (2.16.76.1.3.3) ou CPF (posições 9-19 de 2.16.76.1.3.1) do OtherName. */
export function readIcpIdentity(der: Buffer): IcpIdentity {
  const san = extensionValue(der, OID_SAN);
  const out: IcpIdentity = { cnpj: null, cpf: null };
  if (!san) return out;
  const seq = readTlv(san, 0);
  for (const gn of children(san, seq)) {
    if (gn.tag !== 0xa0) continue; // otherName
    const [oidT, valT] = children(san, gn);
    if (!oidT || oidT.tag !== 0x06 || !valT) continue;
    const oid = decodeOid(san.subarray(oidT.start, oidT.end));
    const value = stringValue(san, valT).trim();
    if (oid === OID_CNPJ && /^[0-9A-Z]{12}\d{2}$/.test(value)) out.cnpj = value;
    if (oid === OID_CPF_DADOS && /^\d{19}/.test(value))
      out.cpf = value.slice(8, 19);
  }
  return out;
}

export function readKeyUsage(der: Buffer): {
  digitalSignature: boolean;
  nonRepudiation: boolean;
} {
  const ku = extensionValue(der, OID_KEY_USAGE);
  if (!ku) return { digitalSignature: false, nonRepudiation: false };
  const bits = readTlv(ku, 0);
  const first = ku[bits.start + 1] ?? 0; // byte 0 = bits não usados
  return {
    digitalSignature: (first & 0x80) !== 0,
    nonRepudiation: (first & 0x40) !== 0,
  };
}

const isoDate = (s: string) => new Date(s).toISOString().slice(0, 10);

/**
 * Metadados do certificado a partir do X.509 público. `icpBrasilV3` aqui
 * confere só a versão 3; a cadeia até a raiz ICP-Brasil e a LCR são
 * conferidas pela SEFIN (E1205/E1206/E1208) e, antes disso, pelo processo
 * de cadastro no cofre (doc 29).
 */
export function inspectCertificate(
  certificate: Buffer | string,
  vaultReference: string,
): CertificateMetadata & { version: number; subject: string; issuer: string } {
  const x = new X509Certificate(certificate);
  const der = x.raw;
  const id = readIcpIdentity(der);
  const ku = readKeyUsage(der);
  // Versão: [0] EXPLICIT INTEGER no início do TBSCertificate (ausente = v1).
  const cert = readTlv(der, 0);
  const tbs = readTlv(der, cert.start);
  const firstTbs = readTlv(der, tbs.start);
  const version =
    firstTbs.tag === 0xa0 ? der[readTlv(der, firstTbs.start).start] + 1 : 1;
  return {
    holderDocument: id.cnpj ?? id.cpf ?? "",
    validFrom: isoDate(x.validFrom),
    validUntil: isoDate(x.validTo),
    fingerprintSha256: x.fingerprint256.replace(/:/g, "").toLowerCase(),
    vaultReference,
    icpBrasilV3: version === 3,
    kind: "A1",
    keyUsageDigitalSignature: ku.digitalSignature,
    keyUsageNonRepudiation: ku.nonRepudiation,
    clientAuth: (x.keyUsage ?? []).includes(EKU_CLIENT_AUTH),
    isCa: x.ca,
    revoked: false,
    version,
    subject: x.subject,
    issuer: x.issuer,
  };
}
