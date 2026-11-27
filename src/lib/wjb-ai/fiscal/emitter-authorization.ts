/**
 * Quem pode emitir em nome de uma empresa (Fase 5). Regras puras, sem banco,
 * testáveis. Fonte: FAQ NFS-e v1.4 (18/11/2026), assuntos 17.1, 17.2, 17.7,
 * 28.2 a 28.6.
 *
 * Modelo A (`wjb_procuracao`): certificado e-CNPJ da WJB + procuração
 *   eletrônica do cliente no Portal de Serviços da RFB, serviço da NFS-e, em
 *   favor do CNPJ da WJB. mTLS e assinatura podem ser da WJB; o `<emit>` da
 *   DPS continua com o CNPJ do cliente.
 * Modelo B (`certificado_cliente`): certificado do próprio cliente; titular
 *   = emitente da DPS.
 *
 * O sistema nunca vê a procuração na RFB: a equipe registra a evidência e a
 * validade, e a conferência real acontece na SEFIN (E0718 se não existir).
 * Por isso uma procuração registrada só vale se não estiver revogada nem
 * vencida, e o primeiro uso real exige conferência humana (doc 25).
 */
export type EmissionModel = "wjb_procuracao" | "certificado_cliente";

export interface CertificateMetadata {
  holderDocument: string; // CNPJ/CPF do OtherName
  validFrom: string; // AAAA-MM-DD
  validUntil: string;
  fingerprintSha256: string;
  vaultReference: string; // vault://...
  icpBrasilV3: boolean;
  kind: "A1" | "A3";
  keyUsageDigitalSignature: boolean;
  keyUsageNonRepudiation: boolean;
  clientAuth: boolean;
  isCa: boolean;
  revoked: boolean;
}

export interface AuthorizationRecord {
  id: string;
  kind: "procuracao" | "certificado_proprio" | "consentimento_assistido";
  emissionModel: EmissionModel | null;
  status: "active" | "revoked" | "expired";
  scope: string;
  validUntil: string;
  revokedAt: string | null;
  /** Modelo A: CNPJ do procurador (WJB). Modelo B: titular do certificado. */
  holderDocument: string | null;
  certificate: CertificateMetadata | null;
}

export interface AuthorizationIssue {
  code: string;
  message: string;
}

export type EmitterAuthorization =
  | {
      ok: true;
      model: EmissionModel;
      grantId: string;
      signerCertificate: CertificateMetadata;
      warnings: AuthorizationIssue[];
    }
  | { ok: false; blockers: AuthorizationIssue[] };

/** Fase 10C: avisos nos marcos 90/60/30/15/7 (certificate-lifecycle). */
const EXPIRY_WARNING_DAYS = 90;
const VAULT_REF = /^vault:\/\/[A-Za-z0-9._/-]{3,200}$/;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Requisitos do certificado (FAQ 17.1/17.2). Nunca olha a chave privada. */
export function checkCertificate(
  cert: CertificateMetadata,
  today: string,
): { blockers: AuthorizationIssue[]; warnings: AuthorizationIssue[] } {
  const blockers: AuthorizationIssue[] = [];
  const warnings: AuthorizationIssue[] = [];
  if (!cert.icpBrasilV3)
    blockers.push({
      code: "CERT_NOT_ICP",
      message: "Certificado não é ICP-Brasil v3.",
    });
  if (!cert.keyUsageDigitalSignature || !cert.keyUsageNonRepudiation)
    blockers.push({
      code: "CERT_KEY_USAGE",
      message: "Certificado sem uso de Assinatura Digital e Não Recusa.",
    });
  if (!cert.clientAuth)
    blockers.push({
      code: "CERT_CLIENT_AUTH",
      message: "Certificado sem Autenticação de Cliente (necessária ao mTLS).",
    });
  if (cert.isCa)
    blockers.push({
      code: "CERT_IS_CA",
      message:
        "Certificado de AC não é aceito (Basic Constraint deve ser falso).",
    });
  if (cert.revoked)
    blockers.push({ code: "CERT_REVOKED", message: "Certificado revogado." });
  if (cert.validFrom > today)
    blockers.push({
      code: "CERT_NOT_YET_VALID",
      message: "Certificado ainda não é válido.",
    });
  if (cert.validUntil < today)
    blockers.push({ code: "CERT_EXPIRED", message: "Certificado vencido." });
  else if (daysBetween(today, cert.validUntil) <= EXPIRY_WARNING_DAYS)
    warnings.push({
      code: "CERT_EXPIRING",
      message: `Certificado vence em ${daysBetween(today, cert.validUntil)} dia(s).`,
    });
  if (!VAULT_REF.test(cert.vaultReference))
    blockers.push({
      code: "CERT_NO_VAULT",
      message: "Certificado sem referência válida ao cofre.",
    });
  return { blockers, warnings };
}

function grantUsable(
  g: AuthorizationRecord,
  today: string,
): AuthorizationIssue | null {
  if (g.revokedAt || g.status === "revoked")
    return { code: "GRANT_REVOKED", message: "Autorização revogada." };
  if (g.validUntil < today || g.status === "expired")
    return { code: "GRANT_EXPIRED", message: "Autorização vencida." };
  if (!/nfs-?e/i.test(g.scope))
    return {
      code: "GRANT_SCOPE",
      message: "O escopo da autorização não cobre a NFS-e.",
    };
  return null;
}

/**
 * Decide o modelo de emissão. Ordem: A (WJB com procuração), depois B
 * (certificado do cliente). Devolve TODOS os bloqueios se nenhum servir.
 */
export function evaluateEmitterAuthorization(input: {
  tenantDocument: string;
  grants: AuthorizationRecord[];
  wjbCertificate: CertificateMetadata | null;
  today: string;
}): EmitterAuthorization {
  const blockers: AuthorizationIssue[] = [];
  const tenantDoc = input.tenantDocument.replace(/\D/g, "");

  const procuracoes = input.grants.filter(
    (g) => g.kind === "procuracao" && g.emissionModel === "wjb_procuracao",
  );
  for (const g of procuracoes) {
    const issue = grantUsable(g, input.today);
    if (issue) {
      blockers.push({ ...issue, message: `Modelo A: ${issue.message}` });
      continue;
    }
    if (!input.wjbCertificate) {
      blockers.push({
        code: "WJB_CERT_MISSING",
        message: "Modelo A: certificado da WJB não cadastrado no cofre.",
      });
      continue;
    }
    if (g.holderDocument !== input.wjbCertificate.holderDocument) {
      blockers.push({
        code: "GRANT_HOLDER_MISMATCH",
        message:
          "Modelo A: a procuração foi registrada para um CNPJ diferente do titular do certificado da WJB (a SEFIN rejeitaria com E0718).",
      });
      continue;
    }
    const c = checkCertificate(input.wjbCertificate, input.today);
    if (c.blockers.length) {
      blockers.push(
        ...c.blockers.map((b) => ({ ...b, message: `Modelo A: ${b.message}` })),
      );
      continue;
    }
    return {
      ok: true,
      model: "wjb_procuracao",
      grantId: g.id,
      signerCertificate: input.wjbCertificate,
      warnings: c.warnings,
    };
  }

  const proprios = input.grants.filter(
    (g) =>
      g.kind === "certificado_proprio" &&
      g.emissionModel === "certificado_cliente",
  );
  for (const g of proprios) {
    const issue = grantUsable(g, input.today);
    if (issue) {
      blockers.push({ ...issue, message: `Modelo B: ${issue.message}` });
      continue;
    }
    if (!g.certificate) {
      blockers.push({
        code: "CLIENT_CERT_MISSING",
        message: "Modelo B: certificado do cliente sem metadados cadastrados.",
      });
      continue;
    }
    if (g.certificate.holderDocument !== tenantDoc) {
      blockers.push({
        code: "CLIENT_CERT_HOLDER_MISMATCH",
        message:
          "Modelo B: o titular do certificado não é o emitente (a SEFIN rejeitaria com E0718).",
      });
      continue;
    }
    const c = checkCertificate(g.certificate, input.today);
    if (c.blockers.length) {
      blockers.push(
        ...c.blockers.map((b) => ({ ...b, message: `Modelo B: ${b.message}` })),
      );
      continue;
    }
    return {
      ok: true,
      model: "certificado_cliente",
      grantId: g.id,
      signerCertificate: g.certificate,
      warnings: c.warnings,
    };
  }

  if (!procuracoes.length && !proprios.length)
    blockers.push({
      code: "NO_AUTHORIZATION",
      message:
        "Nenhuma procuração (modelo A) nem certificado do cliente (modelo B) registrado.",
    });
  return { ok: false, blockers };
}
