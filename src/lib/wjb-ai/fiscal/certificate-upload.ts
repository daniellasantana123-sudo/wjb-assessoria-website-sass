import { X509Certificate } from "node:crypto";

import { evaluateRotation, spkiSha256, type CertificateRole, type RotationIssue } from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import type { CertificateRegistryRepo } from "@/lib/wjb-ai/fiscal/certificate-rotation";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import {
  CERTIFICATE_POLICY,
  evaluateCertificatePolicy,
  type RevocationChecker,
  type TrustStore,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";

/**
 * Envio do certificado PÚBLICO pelo Admin (Fase 10F).
 *
 * Por desenho, a plataforma nunca recebe a chave privada nem a senha: a
 * titular grava a chave cifrada direto no cofre (doc 04 da Fase 10F), e o
 * servidor só tem permissão de LEITURA no cofre. Aqui entra apenas o X.509
 * público (.cer, .crt ou .pem), para conferir ANTES de qualquer cadastro:
 * formato, titular (e-CNPJ/e-CPF), CNPJ da empresa, cadeia ICP-Brasil,
 * revogação, validade, incidente de 26/11, bloqueio permanente (impressão
 * digital e chave pública) e regras de rotação.
 *
 * Arquivo com chave privada ou PFX é RECUSADO sem ser lido, e nada do arquivo
 * é gravado: o resultado traz só a impressão digital, o documento mascarado e
 * as datas. O cadastro em si continua em `registerCertificateFromVault`, que
 * lê do cofre e confere que é o mesmo certificado.
 */
export const MAX_CERTIFICATE_UPLOAD_BYTES = 16 * 1024;

export interface UploadDeps {
  trust: TrustStore | null;
  revocation: RevocationChecker | null;
  repo: Pick<CertificateRegistryRepo, "isBlocked" | "getActive">;
  /** Fora de testes: true (exige ICP-Brasil e LCR/OCSP reais). */
  requireRealVerification: boolean;
  now?: Date;
}

export interface UploadSummary {
  fingerprint: string;
  spki: string;
  holderMasked: string;
  holderKind: "e-CNPJ" | "e-CPF" | "desconhecido";
  validFrom: string;
  validUntil: string;
  daysLeft: number;
}

export type UploadResult =
  | { ok: true; summary: UploadSummary; warnings: RotationIssue[] }
  | { ok: false; blockers: RotationIssue[]; summary: UploadSummary | null };

const refuse = (code: string, message: string): UploadResult => ({ ok: false, blockers: [{ code, message }], summary: null });

/** PKCS#12 (PFX) em DER começa com SEQUENCE { INTEGER 3, ContentInfo(pkcs7-data) ... }. */
function looksLikePfx(buf: Buffer): boolean {
  if (buf[0] !== 0x30) return false;
  const lenByte = buf[1];
  const offset = lenByte < 0x80 ? 2 : 2 + (lenByte & 0x7f);
  return buf[offset] === 0x02 && buf[offset + 1] === 0x01 && buf[offset + 2] === 0x03;
}

/** Lê o certificado do arquivo enviado. Nunca interpreta chave privada. */
export function parseUploadedCertificate(file: Buffer): { ok: true; der: Buffer } | { ok: false; code: string; message: string } {
  if (file.length === 0) return { ok: false, code: "UPLOAD_VAZIO", message: "Arquivo vazio." };
  if (file.length > MAX_CERTIFICATE_UPLOAD_BYTES)
    return { ok: false, code: "UPLOAD_GRANDE", message: "Arquivo grande demais para um certificado público (máximo 16 KB)." };
  const text = file.toString("latin1");
  if (/PRIVATE KEY/.test(text))
    return { ok: false, code: "CHAVE_PRIVADA_RECUSADA", message: "O arquivo tem chave privada. Envie só o certificado público (.cer, .crt ou .pem). A chave vai direto para o cofre, nunca pela plataforma." };
  if (/-----BEGIN /.test(text)) {
    const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
    if (blocks.length !== 1)
      return { ok: false, code: "PEM_INVALIDO", message: "O arquivo PEM precisa ter exatamente um certificado (sem a cadeia)." };
    try {
      return { ok: true, der: new X509Certificate(blocks[0]).raw };
    } catch {
      return { ok: false, code: "FORMATO_INVALIDO", message: "Não foi possível ler o certificado." };
    }
  }
  if (looksLikePfx(file))
    return { ok: false, code: "PFX_RECUSADO", message: "Arquivo PFX/P12 recusado: ele contém a chave privada. Envie só o certificado público (.cer)." };
  try {
    return { ok: true, der: new X509Certificate(file).raw };
  } catch {
    return { ok: false, code: "FORMATO_INVALIDO", message: "Formato não reconhecido. Envie o certificado público em .cer, .crt ou .pem." };
  }
}

export async function validateCertificateUpload(
  input: { file: Buffer; role: CertificateRole; tenantId: string | null; tenantDocument?: string | null },
  deps: UploadDeps,
): Promise<UploadResult> {
  const parsed = parseUploadedCertificate(input.file);
  if (!parsed.ok) return refuse(parsed.code, parsed.message);
  const now = deps.now ?? new Date();
  const meta = inspectCertificate(parsed.der, "vault://upload/sem-material");
  const x = new X509Certificate(parsed.der);
  if (x.ca) return refuse("CERTIFICADO_DE_AC", "Este é um certificado de autoridade certificadora, não o certificado da empresa.");
  const spki = spkiSha256(x.publicKey.export({ type: "spki", format: "der" }));
  const summary: UploadSummary = {
    fingerprint: meta.fingerprintSha256,
    spki,
    holderMasked: meta.holderDocument ? maskDocument(meta.holderDocument) : "não identificado",
    holderKind: meta.holderDocument.length === 14 ? "e-CNPJ" : meta.holderDocument.length === 11 ? "e-CPF" : "desconhecido",
    validFrom: meta.validFrom,
    validUntil: meta.validUntil,
    daysLeft: Math.floor((new Date(`${meta.validUntil}T00:00:00Z`).getTime() - now.getTime()) / 86_400_000),
  };
  const blockers: RotationIssue[] = [];
  if (await deps.repo.isBlocked(meta.fingerprintSha256, spki))
    blockers.push({ code: "CERT_BLOCKLISTED", message: "Certificado ou chave bloqueados permanentemente." });
  const policy = await evaluateCertificatePolicy({
    certificate: parsed.der,
    role: input.role,
    at: now,
    trust: deps.trust,
    revocation: deps.revocation,
  });
  const rotation = evaluateRotation({
    current: await deps.repo.getActive(input.role, input.tenantId),
    candidate: {
      id: "upload",
      role: input.role,
      tenantId: input.tenantId,
      fingerprint: meta.fingerprintSha256,
      spki,
      holderDocument: meta.holderDocument,
      validFrom: `${meta.validFrom}T00:00:00Z`,
      validUntil: `${meta.validUntil}T00:00:00Z`,
      status: "pendente",
    },
    policy,
    trustKind: deps.trust?.kind ?? null,
    revocationKind: deps.revocation?.kind ?? null,
    requireRealVerification: deps.requireRealVerification,
    wjbDocuments: CERTIFICATE_POLICY.wjbDocuments,
    tenantDocument: input.tenantDocument,
    now,
  });
  if (!rotation.ok) blockers.push(...rotation.blockers);
  // Bloqueios iguais (política e rotação podem repetir) aparecem uma vez só.
  const unique = blockers.filter((b, i) => blockers.findIndex((o) => o.code === b.code) === i);
  if (unique.length) return { ok: false, blockers: unique, summary };
  return { ok: true, summary, warnings: rotation.ok ? rotation.warnings : [] };
}
