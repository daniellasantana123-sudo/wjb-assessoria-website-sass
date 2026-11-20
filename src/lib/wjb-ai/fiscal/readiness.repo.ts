import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import {
  evaluateEmitterAuthorization,
  type AuthorizationRecord,
  type CertificateMetadata,
} from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { resolveLayout } from "@/lib/wjb-ai/fiscal/national/layouts";
import { evaluateFiscalReadiness } from "@/lib/wjb-ai/fiscal/profile-settings";

/**
 * Metadados (NÃO o arquivo) do certificado e-CNPJ da WJB para o modelo A.
 * Lidos em runtime de `WJB_AI_WJB_CERTIFICATE_METADATA` (JSON). Ausente =
 * modelo A indisponível. O PFX, a chave e a senha nunca passam por aqui:
 * ficam no cofre referenciado por `vaultReference` (doc 26).
 */
export function getWjbCertificateMetadata(): CertificateMetadata | null {
  const raw = process.env["WJB_AI_WJB_CERTIFICATE_METADATA"];
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CertificateMetadata>;
    if (
      typeof v.holderDocument !== "string" ||
      typeof v.validFrom !== "string" ||
      typeof v.validUntil !== "string" ||
      typeof v.fingerprintSha256 !== "string" ||
      typeof v.vaultReference !== "string"
    )
      return null;
    return {
      holderDocument: v.holderDocument,
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      fingerprintSha256: v.fingerprintSha256,
      vaultReference: v.vaultReference,
      icpBrasilV3: v.icpBrasilV3 === true,
      kind: v.kind === "A3" ? "A3" : "A1",
      keyUsageDigitalSignature: v.keyUsageDigitalSignature === true,
      keyUsageNonRepudiation: v.keyUsageNonRepudiation === true,
      clientAuth: v.clientAuth === true,
      isCa: v.isCa === true,
      revoked: v.revoked === true,
    };
  } catch {
    return null;
  }
}

type GrantRow = {
  id: string;
  kind: string;
  emission_model: string | null;
  status: string;
  scope: string;
  valid_until: string;
  revoked_at: string | null;
  certificate_holder_document: string | null;
  certificate_valid_from: string | null;
  certificate_valid_until: string | null;
  certificate_fingerprint_sha256: string | null;
  certificate_vault_reference: string | null;
  certificate_kind: string | null;
  certificate_requirements_confirmed: boolean;
};

export function toAuthorizationRecord(g: GrantRow): AuthorizationRecord {
  const hasCert =
    g.emission_model === "certificado_cliente" &&
    g.certificate_holder_document &&
    g.certificate_valid_from &&
    g.certificate_valid_until;
  const confirmed = g.certificate_requirements_confirmed;
  return {
    id: g.id,
    kind: g.kind as AuthorizationRecord["kind"],
    emissionModel:
      (g.emission_model as AuthorizationRecord["emissionModel"]) ?? null,
    status: g.status as AuthorizationRecord["status"],
    scope: g.scope,
    validUntil: g.valid_until,
    revokedAt: g.revoked_at,
    holderDocument: g.certificate_holder_document,
    certificate: hasCert
      ? {
          holderDocument: g.certificate_holder_document!,
          validFrom: g.certificate_valid_from!,
          validUntil: g.certificate_valid_until!,
          fingerprintSha256: g.certificate_fingerprint_sha256 ?? "",
          vaultReference: g.certificate_vault_reference ?? "",
          kind: g.certificate_kind === "A3" ? "A3" : "A1",
          icpBrasilV3: confirmed,
          keyUsageDigitalSignature: confirmed,
          keyUsageNonRepudiation: confirmed,
          clientAuth: confirmed,
          isCa: !confirmed,
          revoked: false,
        }
      : null,
  };
}

export async function loadTenantReadiness(
  tenantId: string,
  today: string,
  environment: "producao_restrita" | "producao" = "producao_restrita",
) {
  const admin = createAdminClient();
  const [
    { data: tenant },
    { data: profile },
    { data: grants },
    { data: series },
  ] = await Promise.all([
    admin.from("tenants").select("cnpj").eq("id", tenantId).maybeSingle(),
    admin
      .from("fiscal_profiles")
      .select("status, service_settings")
      .eq("tenant_id", tenantId)
      .eq("status", "approved")
      .maybeSingle(),
    admin
      .from("fiscal_authorization_grants")
      .select(
        "id, kind, emission_model, status, scope, valid_until, revoked_at, certificate_holder_document, certificate_valid_from, certificate_valid_until, certificate_fingerprint_sha256, certificate_vault_reference, certificate_kind, certificate_requirements_confirmed",
      )
      .eq("tenant_id", tenantId),
    admin
      .from("fiscal_dps_series")
      .select("series")
      .eq("tenant_id", tenantId)
      .eq(
        "environment",
        environment === "producao" ? "producao" : "producao_restrita",
      )
      .eq("active", true)
      .maybeSingle(),
  ]);
  const tenantDocument = (tenant?.cnpj ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  const authorization = evaluateEmitterAuthorization({
    tenantDocument,
    grants: ((grants ?? []) as GrantRow[]).map(toAuthorizationRecord),
    wjbCertificate: getWjbCertificateMetadata(),
    today,
  });
  return evaluateFiscalReadiness({
    profileStatus: profile ? "approved" : null,
    rawSettings: profile?.service_settings ?? null,
    tenantDocument,
    authorization,
    layout: resolveLayout(environment, today),
    seriesConfigured: series?.series ?? null,
  });
}
