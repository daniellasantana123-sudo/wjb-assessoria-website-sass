import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import type {
  CertificateUsageRecord,
  CertificateUsageSink,
} from "@/lib/wjb-ai/fiscal/certificate-vault";
import {
  evaluateFiscalAlerts,
  type FiscalAlert,
} from "@/lib/wjb-ai/fiscal/monitoring";

/** Trilha de uso do certificado no banco (migration 0028, só service role grava). */
export class SupabaseCertificateUsageSink implements CertificateUsageSink {
  async record(e: CertificateUsageRecord) {
    const { error } = await createAdminClient()
      .from("fiscal_certificate_usage")
      .insert({
        tenant_id: e.tenantId,
        request_id: e.requestId,
        grant_id: e.grantId,
        emission_model: e.emissionModel,
        certificate_fingerprint: e.certificateFingerprint,
        purpose: e.purpose,
        environment: e.environment,
        outcome: e.outcome,
        reason: e.reason,
      });
    // Sem trilha, sem uso: falha ao auditar interrompe a operação.
    if (error) throw new Error("Falha ao registrar o uso do certificado.");
  }
}

export async function loadFiscalAlerts(
  now = new Date(),
): Promise<FiscalAlert[]> {
  const admin = createAdminClient();
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const [{ data: grants }, { data: requests }, { data: usage }] =
    await Promise.all([
      admin
        .from("fiscal_authorization_grants")
        .select(
          "id, tenant_id, kind, valid_until, revoked_at, certificate_valid_until",
        )
        .is("revoked_at", null),
      admin
        .from("fiscal_requests")
        .select(
          "id, tenant_id, status, updated_at, needs_intervention, last_error",
        )
        .or(
          "status.in.(RESULTADO_INDETERMINADO,CONCILIACAO_OFICIAL),needs_intervention.eq.true,last_error.not.is.null",
        )
        .limit(500),
      admin
        .from("fiscal_certificate_usage")
        .select("tenant_id, reason")
        .eq("outcome", "negado")
        .gte("used_at", since)
        .limit(1000),
    ]);
  return evaluateFiscalAlerts({
    now,
    grants: (grants ?? []).map((g) => ({
      id: g.id,
      tenantId: g.tenant_id,
      kind: g.kind,
      validUntil: g.valid_until,
      revokedAt: g.revoked_at,
      certificateValidUntil: g.certificate_valid_until,
    })),
    requests: (requests ?? []).map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      status: r.status,
      updatedAt: r.updated_at,
      needsIntervention: r.needs_intervention,
      lastError: r.last_error,
    })),
    usageDenied24h: (usage ?? []).map((u) => ({
      tenantId: u.tenant_id,
      reason: u.reason,
    })),
  });
}
