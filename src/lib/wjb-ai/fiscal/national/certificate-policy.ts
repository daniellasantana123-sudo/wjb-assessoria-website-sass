import "server-only";

import { X509Certificate } from "node:crypto";

import { siteConfig } from "@/config/site";
import {
  readIcpIdentity,
  readKeyUsage,
} from "@/lib/wjb-ai/fiscal/national/certificate-inspect";

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
 *
 * Revisão de segurança da Fase 10B (aplicada): a regra do incidente vale pelo
 * TITULAR (CNPJ da WJB), não só pelo modelo de emissão; impressões digitais
 * são normalizadas e validadas; datas comparadas por instante; o certificado
 * final precisa ser de usuário final; algoritmos por lista de PERMITIDOS.
 */
export const CERTIFICATE_INCIDENT_DATE = "2026-11-26";
/** Início do dia do incidente em Brasília. */
export const CERTIFICATE_INCIDENT_CUTOFF = "2026-11-26T00:00:00-03:00";

export interface CertificatePolicyConfig {
  /** SHA-256 em hexadecimal (aceita dois-pontos e maiúsculas: é normalizado). */
  compromisedFingerprints: readonly string[];
  /** Certificados da WJB com `notBefore` anterior são recusados (ISO com fuso). */
  wjbMinimumIssuance: string;
  /** Documentos (só dígitos) que identificam a WJB como titular. */
  wjbDocuments: readonly string[];
  minRsaBits: number;
}

export const CERTIFICATE_POLICY: CertificatePolicyConfig = {
  compromisedFingerprints: [],
  wjbMinimumIssuance: CERTIFICATE_INCIDENT_CUTOFF,
  wjbDocuments: [siteConfig.company.cnpj.replace(/\D/g, "")],
  minRsaBits: 2048,
};

/** Normaliza e valida uma impressão digital SHA-256. Inválida = erro. */
export function normalizeFingerprint(raw: string): string {
  const v = raw.replace(/[:\s]/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(v))
    throw new Error("Impressão digital SHA-256 inválida na política.");
  return v;
}

function assertConfig(cfg: CertificatePolicyConfig) {
  cfg.compromisedFingerprints.forEach(normalizeFingerprint);
  if (Number.isNaN(Date.parse(cfg.wjbMinimumIssuance)))
    throw new Error("Data mínima de emissão inválida na política.");
}
// Configuração inválida derruba o módulo na carga, nunca desliga o bloqueio.
assertConfig(CERTIFICATE_POLICY);

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

function withinValidity(c: X509Certificate, at: Date) {
  return (
    new Date(c.validFrom).getTime() <= at.getTime() &&
    at.getTime() <= new Date(c.validTo).getTime()
  );
}

export function verifyChain(
  leaf: X509Certificate,
  store: TrustStore,
  at: Date,
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
    if (!withinValidity(issuer, at))
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

/** Algoritmos de assinatura do CERTIFICADO aceitos (lista de permitidos). */
const ALLOWED_CERT_SIGNATURES = new Set([
  "sha256WithRSAEncryption",
  "sha384WithRSAEncryption",
  "sha512WithRSAEncryption",
]);
const EKU_CLIENT_AUTH = "1.3.6.1.5.5.7.3.2";

export interface PolicyInput {
  certificate: Buffer | string | X509Certificate;
  /** "wjb": certificado da WJB (modelo A). "cliente": do próprio cliente (B). */
  role: "wjb" | "cliente";
  /** Instante da verificação (padrão: agora). */
  at?: Date;
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
  assertConfig(cfg);
  const at = input.at ?? new Date();
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

  if (
    cfg.compromisedFingerprints.map(normalizeFingerprint).includes(fingerprint)
  )
    blockers.push({
      code: "CERT_COMPROMISED",
      message:
        "Certificado marcado como comprometido (incidente de segurança). Uso proibido.",
    });

  // A regra do incidente vale para o PAPEL "wjb" e também para qualquer
  // certificado cujo titular seja a WJB, cadastrado em qualquer modelo.
  const identity = readIcpIdentity(x.raw);
  const wjbHolder = !!identity.cnpj && cfg.wjbDocuments.includes(identity.cnpj);
  if (input.role === "wjb" || wjbHolder) {
    if (new Date(x.validFrom).getTime() < Date.parse(cfg.wjbMinimumIssuance))
      blockers.push({
        code: "CERT_ISSUED_BEFORE_INCIDENT",
        message: `Certificado da WJB emitido antes de ${CERTIFICATE_INCIDENT_DATE} (data do incidente). Só o certificado reemitido é aceito.`,
      });
  }
  if (input.role === "wjb") {
    if (!identity.cnpj)
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
  if (!sigAlg || !ALLOWED_CERT_SIGNATURES.has(sigAlg))
    blockers.push({
      code: "CERT_SIGNATURE_ALGORITHM",
      message: "Certificado assinado com algoritmo fraco ou desconhecido.",
    });

  if (x.ca)
    blockers.push({
      code: "CERT_LEAF_IS_CA",
      message: "Certificado de AC apresentado como certificado de usuário.",
    });
  const ku = readKeyUsage(x.raw);
  if (!ku.digitalSignature || !(x.keyUsage ?? []).includes(EKU_CLIENT_AUTH))
    blockers.push({
      code: "CERT_LEAF_USAGE",
      message:
        "Certificado sem Assinatura Digital ou sem Autenticação de Cliente.",
    });

  if (!withinValidity(x, at))
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
    const chain = verifyChain(x, input.trust, at);
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
