import { X509Certificate } from "node:crypto";

import { readIcpIdentity } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";

/**
 * Política de aceitação de certificado (Fase 10B, 26/11/2026).
 *
 * Complementa `checkCertificate` (metadados cadastrados) com o que só se
 * confere no certificado REAL, na hora do uso, e SEMPRE falha fechado:
 * - cadeia até uma âncora de confiança conhecida (sem âncora = recusa);
 * - revogação (sem verificador ou resposta "desconhecida" = recusa);
 * - algoritmo: chave RSA >= 2048 e certificado não assinado com SHA-1/MD5;
 * - incidente de 26/11/2026: um certificado da WJB (PFX + senha) foi exposto
 *   numa conversa. Nenhum certificado da WJB emitido ANTES da data do
 *   incidente é aceito, e o modelo A exige e-CNPJ. Assim o exposto e qualquer
 *   cópia dele ficam inutilizáveis mesmo sem conhecermos o arquivo: nunca
 *   abrimos, lemos ou guardamos o certificado exposto, nem dados dele.
 * - lista de impressões digitais comprometidas (SHA-256, dado público do
 *   certificado). Começa vazia: a WJB pode preencher a do certificado
 *   revogado calculando-a no próprio computador (script
 *   `scripts/wjb-ai/certificado/verificar-certificado.mjs`), sem enviá-lo.
 *
 * Nenhum dado pessoal (CPF, nome) entra nesta configuração nem nos códigos de
 * bloqueio.
 */
export const CERTIFICATE_INCIDENT_DATE = "2026-11-26";

export interface CertificatePolicyConfig {
  /** SHA-256 em hexadecimal minúsculo, sem dois-pontos. */
  compromisedFingerprints: readonly string[];
  /** Certificados da WJB (modelo A) com `notBefore` anterior são recusados. */
  wjbMinimumIssuanceDate: string;
  minRsaBits: number;
}

export const CERTIFICATE_POLICY: CertificatePolicyConfig = {
  compromisedFingerprints: [],
  wjbMinimumIssuanceDate: CERTIFICATE_INCIDENT_DATE,
  minRsaBits: 2048,
};

export interface PolicyIssue {
  code: string;
  message: string;
}

// ---------------------------------------------------------------- cadeia

/** Âncoras e intermediárias. Só o cofre de TESTE tem um repositório pronto. */
export interface TrustStore {
  readonly kind: "teste" | "icp-brasil";
  anchors: readonly X509Certificate[];
  intermediates: readonly X509Certificate[];
}

export class TrustStoreNotConfiguredError extends Error {
  constructor() {
    super(
      "Cadeia ICP-Brasil não configurada: as raízes oficiais (ITI) ainda não foram baixadas, conferidas e versionadas.",
    );
    this.name = "TrustStoreNotConfiguredError";
  }
}

/** Repositório ICP-Brasil real: pendente (doc FASE-10B-CERTIFICADOS-E-SEGREDOS). */
export function createIcpBrasilTrustStore(): TrustStore {
  throw new TrustStoreNotConfiguredError();
}

const iso = (s: string) => new Date(s).toISOString().slice(0, 10);

function withinValidity(c: X509Certificate, today: string) {
  return iso(c.validFrom) <= today && today <= iso(c.validTo);
}

export function verifyChain(
  leaf: X509Certificate,
  store: TrustStore,
  today: string,
): PolicyIssue | null {
  const pool = [...store.intermediates, ...store.anchors];
  const isAnchor = (c: X509Certificate) =>
    store.anchors.some((a) => a.fingerprint256 === c.fingerprint256);
  let current = leaf;
  for (let depth = 0; depth < 6; depth++) {
    const issuer = pool.find(
      (cand) =>
        cand.fingerprint256 !== current.fingerprint256 &&
        cand.ca &&
        current.checkIssued(cand) &&
        current.verify(cand.publicKey),
    );
    if (!issuer)
      return {
        code: "CERT_CHAIN_UNTRUSTED",
        message: "A cadeia do certificado não chega a uma raiz confiável.",
      };
    if (!withinValidity(issuer, today))
      return {
        code: "CERT_CHAIN_EXPIRED",
        message: "Um certificado da cadeia (AC) está fora da validade.",
      };
    if (isAnchor(issuer)) return null;
    current = issuer;
  }
  return {
    code: "CERT_CHAIN_TOO_LONG",
    message: "Cadeia do certificado longa demais.",
  };
}

// ------------------------------------------------------------- revogação

export type RevocationStatus = "good" | "revoked" | "unknown";

export interface RevocationChecker {
  readonly kind: "simulado" | "lcr-ocsp";
  check(certificate: X509Certificate): Promise<RevocationStatus>;
}

export class RevocationCheckerNotConfiguredError extends Error {
  constructor() {
    super(
      "Verificação de revogação (LCR/OCSP ICP-Brasil) não configurada nesta fase.",
    );
    this.name = "RevocationCheckerNotConfiguredError";
  }
}

export function createRevocationChecker(): RevocationChecker {
  throw new RevocationCheckerNotConfiguredError();
}

/** Só para testes: revogação por impressão digital, ou "desconhecido". */
export class SimulatedRevocationChecker implements RevocationChecker {
  readonly kind = "simulado" as const;
  readonly revoked = new Set<string>();
  unavailable = false;
  async check(c: X509Certificate): Promise<RevocationStatus> {
    if (this.unavailable) return "unknown";
    return this.revoked.has(fingerprintOf(c)) ? "revoked" : "good";
  }
}

// -------------------------------------------------------------- política

export const fingerprintOf = (c: X509Certificate) =>
  c.fingerprint256.replace(/:/g, "").toLowerCase();

const WEAK_SIGNATURE = /sha1|md5|md2/i;

export interface PolicyInput {
  certificate: Buffer | string | X509Certificate;
  /** "wjb": certificado da WJB (modelo A). "cliente": do próprio cliente (B). */
  role: "wjb" | "cliente";
  today: string;
  trust: TrustStore | null;
  revocation: RevocationChecker | null;
  config?: CertificatePolicyConfig;
}

export type PolicyResult =
  | { ok: true; fingerprint: string }
  | { ok: false; fingerprint: string | null; blockers: PolicyIssue[] };

/**
 * Avalia o certificado. Devolve TODOS os bloqueios encontrados. Nunca recebe
 * a chave privada: só o X.509 público.
 */
export async function evaluateCertificatePolicy(
  input: PolicyInput,
): Promise<PolicyResult> {
  const cfg = input.config ?? CERTIFICATE_POLICY;
  let x: X509Certificate;
  try {
    x =
      input.certificate instanceof X509Certificate
        ? input.certificate
        : new X509Certificate(input.certificate);
  } catch {
    return {
      ok: false,
      fingerprint: null,
      blockers: [{ code: "CERT_UNREADABLE", message: "Certificado ilegível." }],
    };
  }
  const fingerprint = fingerprintOf(x);
  const blockers: PolicyIssue[] = [];

  if (cfg.compromisedFingerprints.includes(fingerprint))
    blockers.push({
      code: "CERT_COMPROMISED",
      message:
        "Certificado marcado como comprometido (incidente de segurança). Uso proibido.",
    });

  if (input.role === "wjb") {
    if (iso(x.validFrom) < cfg.wjbMinimumIssuanceDate)
      blockers.push({
        code: "CERT_ISSUED_BEFORE_INCIDENT",
        message: `Certificado da WJB emitido antes de ${cfg.wjbMinimumIssuanceDate} (data do incidente). Só o certificado reemitido é aceito.`,
      });
    if (!readIcpIdentity(x.raw).cnpj)
      blockers.push({
        code: "WJB_CERT_NOT_ECNPJ",
        message: "O modelo A exige certificado e-CNPJ da WJB.",
      });
  }

  const key = x.publicKey;
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
  if (key.asymmetricKeyType !== "rsa" || bits < cfg.minRsaBits)
    blockers.push({
      code: "CERT_KEY_UNSUPPORTED",
      message: `Chave não suportada: exige RSA de ${cfg.minRsaBits} bits ou mais.`,
    });
  const sigAlg = (x as X509Certificate & { signatureAlgorithm?: string })
    .signatureAlgorithm;
  if (!sigAlg || WEAK_SIGNATURE.test(sigAlg))
    blockers.push({
      code: "CERT_SIGNATURE_ALGORITHM",
      message: "Certificado assinado com algoritmo fraco ou desconhecido.",
    });

  if (!withinValidity(x, input.today))
    blockers.push({
      code: "CERT_OUT_OF_VALIDITY",
      message: "Certificado fora da validade.",
    });

  if (!input.trust)
    blockers.push({
      code: "CERT_CHAIN_UNVERIFIED",
      message:
        "Cadeia não verificada: repositório de confiança não configurado.",
    });
  else {
    const chain = verifyChain(x, input.trust, input.today);
    if (chain) blockers.push(chain);
  }

  if (!input.revocation)
    blockers.push({
      code: "CERT_REVOCATION_UNVERIFIED",
      message:
        "Revogação não verificada: verificador LCR/OCSP não configurado.",
    });
  else {
    let status: RevocationStatus;
    try {
      status = await input.revocation.check(x);
    } catch {
      status = "unknown";
    }
    if (status === "revoked")
      blockers.push({ code: "CERT_REVOKED", message: "Certificado revogado." });
    if (status === "unknown")
      blockers.push({
        code: "CERT_REVOCATION_UNKNOWN",
        message:
          "Não foi possível confirmar que o certificado não está revogado.",
      });
  }

  return blockers.length
    ? { ok: false, fingerprint, blockers }
    : { ok: true, fingerprint };
}
