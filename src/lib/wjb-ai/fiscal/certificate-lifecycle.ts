import { createHash } from "node:crypto";

import type { PolicyResult } from "@/lib/wjb-ai/fiscal/national/certificate-policy";

/**
 * Ciclo de vida do certificado (Fase 10C, 26/11/2026). Regras puras, sem
 * banco e sem o material do certificado: o banco (migration 0036) garante
 * as mesmas regras de forma independente (defesa em profundidade).
 *
 * - Avisos de vencimento nos marcos de 90, 60, 30, 15 e 7 dias, e no
 *   vencimento. Cada marco é avisado UMA vez por certificado.
 * - Rotação: o novo certificado precisa passar pela política completa
 *   (cadeia, revogação, algoritmo, titular), ser do mesmo titular e papel e
 *   ter impressão digital diferente. A data de emissão sozinha NUNCA prova
 *   que um certificado é seguro: fora de testes, a cadeia e a revogação
 *   precisam ter sido verificadas por mecanismos REAIS (ICP-Brasil e
 *   LCR/OCSP). O certificado anterior fica bloqueado para sempre.
 */
export const EXPIRY_MILESTONES = [90, 60, 30, 15, 7] as const;
export type ExpiryMilestone = (typeof EXPIRY_MILESTONES)[number] | 0;

export type CertificateRole = "wjb" | "cliente";
export type CertificateStatus = "pendente" | "ativo" | "substituido" | "bloqueado";

export interface RegisteredCertificate {
  id: string;
  role: CertificateRole;
  tenantId: string | null;
  fingerprint: string;
  /** SHA-256 da SubjectPublicKeyInfo: identifica a CHAVE (0037). */
  spki?: string;
  holderDocument: string;
  validFrom: string; // ISO com fuso
  validUntil: string; // ISO com fuso
  status: CertificateStatus;
}

const DAY = 86_400_000;
/** Certificado novo precisa durar ao menos isto para valer a troca. */
export const MIN_DAYS_FOR_NEW_CERTIFICATE = 7;

/** Dias inteiros até o vencimento (negativo = já venceu). */
export function daysUntilExpiry(validUntil: string, now: Date): number {
  return Math.floor((Date.parse(validUntil) - now.getTime()) / DAY);
}

/** Marco mais próximo já alcançado; `null` = ainda longe do vencimento. */
export function expiryMilestone(daysLeft: number): ExpiryMilestone | null {
  if (daysLeft < 0) return 0;
  for (const m of [...EXPIRY_MILESTONES].reverse()) if (daysLeft <= m) return m;
  return null;
}

export interface ExpiryNotice {
  certificateId: string;
  tenantId: string | null;
  role: CertificateRole;
  milestone: ExpiryMilestone;
  daysLeft: number;
}

/**
 * Avisos a enviar agora: só certificados ATIVOS, só o marco atual (quem
 * passa de 95 para 40 dias recebe o aviso de 60, não três de uma vez) e
 * nunca um marco já avisado (`sent` = "id:marco").
 */
export function planExpiryNotices(
  certificates: readonly RegisteredCertificate[],
  sent: ReadonlySet<string>,
  now: Date,
): ExpiryNotice[] {
  const out: ExpiryNotice[] = [];
  for (const c of certificates) {
    if (c.status !== "ativo") continue;
    const daysLeft = daysUntilExpiry(c.validUntil, now);
    const milestone = expiryMilestone(daysLeft);
    if (milestone === null || sent.has(`${c.id}:${milestone}`)) continue;
    out.push({ certificateId: c.id, tenantId: c.tenantId, role: c.role, milestone, daysLeft });
  }
  return out;
}

/** Texto do aviso, sem dado pessoal (nem titular, nem impressão digital). */
export function expiryNoticeMessage(n: ExpiryNotice): string {
  const who = n.role === "wjb" ? "Certificado da WJB" : "Certificado de uma empresa cliente";
  if (n.milestone === 0)
    return `${who} venceu: emissões com ele ficam bloqueadas até a rotação para um certificado novo.`;
  return `${who} vence em ${n.daysLeft} dia(s) (aviso de ${n.milestone} dias): providencie a renovação e a rotação.`;
}

export interface RotationIssue {
  code: string;
  message: string;
}

export interface RotationInput {
  current: RegisteredCertificate | null;
  candidate: RegisteredCertificate;
  /** Resultado da política aplicada ao certificado do candidato, lido do cofre. */
  policy: PolicyResult;
  trustKind: "teste" | "icp-brasil" | null;
  revocationKind: "simulado" | "lcr-ocsp" | null;
  /** Fora de testes: exige ICP-Brasil e LCR/OCSP reais. */
  requireRealVerification: boolean;
  wjbDocuments: readonly string[];
  /** Documento (só dígitos) da empresa, para certificado de cliente. */
  tenantDocument?: string | null;
  now: Date;
}

export function evaluateRotation(
  input: RotationInput,
): { ok: true; warnings: RotationIssue[] } | { ok: false; blockers: RotationIssue[] } {
  const { current, candidate } = input;
  const blockers: RotationIssue[] = [];
  const warnings: RotationIssue[] = [];
  if (candidate.status !== "pendente")
    blockers.push({ code: "CANDIDATE_NOT_PENDING", message: "O certificado novo precisa estar pendente." });
  if (candidate.role === "wjb" && candidate.tenantId !== null)
    blockers.push({ code: "ROLE_TENANT_MISMATCH", message: "Certificado da WJB não pertence a empresa cliente." });
  if (candidate.role === "cliente" && !candidate.tenantId)
    blockers.push({ code: "ROLE_TENANT_MISMATCH", message: "Certificado de cliente precisa de empresa." });
  if (candidate.role === "wjb" && !input.wjbDocuments.includes(candidate.holderDocument))
    blockers.push({ code: "WJB_HOLDER", message: "O titular do certificado novo não é a WJB." });
  // Revisão da 10C (M1): certificado da WJB nunca entra como "cliente", e
  // e-CNPJ de cliente precisa ser da própria empresa.
  if (candidate.role === "cliente" && input.wjbDocuments.includes(candidate.holderDocument))
    blockers.push({ code: "CLIENT_HOLDER_IS_WJB", message: "Certificado da WJB não pode ser cadastrado como de cliente." });
  if (
    candidate.role === "cliente" &&
    candidate.holderDocument.length === 14 &&
    candidate.holderDocument !== (input.tenantDocument ?? "").replace(/\D/g, "")
  )
    blockers.push({ code: "CLIENT_HOLDER_MISMATCH", message: "O titular do certificado não é a empresa." });
  if (current) {
    if (current.role !== candidate.role || current.tenantId !== candidate.tenantId)
      blockers.push({ code: "ROTATION_SCOPE", message: "O certificado novo é de outro papel ou outra empresa." });
    if (current.holderDocument !== candidate.holderDocument)
      blockers.push({ code: "ROTATION_HOLDER", message: "O titular do certificado novo é diferente do atual." });
    if (current.fingerprint === candidate.fingerprint)
      blockers.push({ code: "ROTATION_SAME_CERTIFICATE", message: "O certificado novo é o mesmo que o atual." });
    // M2: reemissão com o MESMO par de chaves não resolve um comprometimento.
    if (current.spki && candidate.spki && current.spki === candidate.spki)
      blockers.push({ code: "ROTATION_SAME_KEY", message: "O certificado novo usa a mesma chave do atual." });
    if (Date.parse(candidate.validUntil) <= Date.parse(current.validUntil))
      warnings.push({ code: "ROTATION_NOT_LONGER", message: "O certificado novo não vence depois do atual." });
  }
  if (daysUntilExpiry(candidate.validUntil, input.now) < MIN_DAYS_FOR_NEW_CERTIFICATE)
    blockers.push({ code: "CANDIDATE_EXPIRES_SOON", message: `O certificado novo vence em menos de ${MIN_DAYS_FOR_NEW_CERTIFICATE} dias.` });
  if (!input.policy.ok)
    blockers.push({
      code: "CANDIDATE_POLICY",
      message: `Política recusou o certificado novo: ${input.policy.blockers.map((b) => b.code).join(", ")}.`,
    });
  if (input.policy.fingerprint !== candidate.fingerprint)
    blockers.push({ code: "POLICY_FINGERPRINT_MISMATCH", message: "A política avaliou outro certificado." });
  if (
    input.requireRealVerification &&
    (input.trustKind !== "icp-brasil" || input.revocationKind !== "lcr-ocsp")
  )
    blockers.push({
      code: "VERIFICATION_NOT_REAL",
      message:
        "Cadeia ICP-Brasil e revogação (LCR/OCSP) reais são obrigatórias: data de emissão não basta.",
    });
  return blockers.length ? { ok: false, blockers } : { ok: true, warnings };
}

/** Situação do certificado no registro, consultada a cada uso. */
export interface CertificateLifecycleState {
  registered: boolean;
  status: CertificateStatus | null;
  /** Impressão digital OU chave pública na lista permanente. */
  blocked: boolean;
  role?: CertificateRole | null;
  tenantId?: string | null;
}
export interface CertificateLifecycleLookup {
  state(fingerprint: string, spki: string): Promise<CertificateLifecycleState>;
}

/**
 * Bloqueio de uso: só o ATIVO, fora das listas permanentes, no PAPEL e na
 * EMPRESA do uso (revisão M1: o ativo de outra empresa não serve).
 */
export function lifecycleBlocker(
  s: CertificateLifecycleState,
  expected?: { role: CertificateRole; tenantId: string },
): RotationIssue | null {
  if (s.blocked)
    return { code: "CERT_BLOCKLISTED", message: "Certificado bloqueado permanentemente." };
  if (!s.registered || s.status !== "ativo")
    return { code: "CERT_NOT_ACTIVE", message: "Certificado não é o ativo no registro." };
  if (expected) {
    if (s.role !== expected.role)
      return { code: "CERT_ROLE_MISMATCH", message: "Certificado registrado para outro modelo de emissão." };
    if (expected.role === "cliente" && s.tenantId !== expected.tenantId)
      return { code: "CERT_TENANT_MISMATCH", message: "Certificado registrado para outra empresa." };
  }
  return null;
}

/** SHA-256 da SubjectPublicKeyInfo, em hexadecimal (identifica a chave). */
export function spkiSha256(publicKeyDer: Buffer): string {
  return createHash("sha256").update(publicKeyDer).digest("hex");
}
