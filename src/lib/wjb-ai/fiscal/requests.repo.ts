import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import type {
  ApprovedFiscalProfile,
  AuthorizationGrant,
} from "@/lib/wjb-ai/fiscal/policy";
import type { FiscalRequestRepo } from "@/lib/wjb-ai/fiscal/requests";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Implementação Supabase do repositório fiscal. Leitura e criação usam o
 * cliente do USUÁRIO (a RLS da 0024 garante a empresa); mudanças de estado e
 * eventos usam o service role, porque só o servidor pode gravá-los.
 */
export function createSupabaseFiscalRepo(): FiscalRequestRepo {
  return {
    async insertRequest(row) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("fiscal_requests")
        .insert({
          tenant_id: row.tenantId,
          created_by: row.createdBy,
          idempotency_key: row.idempotencyKey,
          draft_snapshot: row.draft as unknown as Record<string, unknown>,
          draft_hash: row.draftHash,
        })
        .select("id")
        .single();
      if (!error && data) return { id: data.id };
      if (error?.code === "23505") {
        const { data: existing } = await supabase
          .from("fiscal_requests")
          .select("id")
          .eq("tenant_id", row.tenantId)
          .eq("idempotency_key", row.idempotencyKey)
          .maybeSingle();
        if (existing) return { duplicateOfId: existing.id };
      }
      console.error("[wjb-ai] falha ao gravar solicitação:", error?.code);
      return { error: "Não foi possível registrar a solicitação agora." };
    },

    async loadApprovedProfile(tenantId): Promise<ApprovedFiscalProfile | null> {
      const supabase = await createClient();
      const { data } = await supabase
        .from("fiscal_profiles")
        .select("max_amount_cents_without_review")
        .eq("tenant_id", tenantId)
        .eq("status", "approved")
        .maybeSingle();
      return data
        ? {
            approved: true,
            maxAmountCentsWithoutReview: data.max_amount_cents_without_review,
          }
        : null;
    },

    async loadActiveGrant(tenantId): Promise<AuthorizationGrant | null> {
      const supabase = await createClient();
      const { data } = await supabase
        .from("fiscal_authorization_grants")
        .select("status, valid_until")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("valid_until", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { status: "active", validUntil: data.valid_until } : null;
    },

    async applyTransitions({
      requestId,
      tenantId,
      actorId,
      steps,
      decision,
      reasons,
    }) {
      if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return false;
      const admin = createAdminClient();
      const { error: eventsError } = await admin
        .from("fiscal_request_events")
        .insert(
          steps.map((s) => ({
            request_id: requestId,
            tenant_id: tenantId,
            from_status: s.from,
            to_status: s.to,
            actor_id: actorId,
            reason: s.reason,
          })),
        );
      if (eventsError) {
        console.error("[wjb-ai] falha ao gravar eventos:", eventsError.code);
        return false;
      }
      const { error } = await admin
        .from("fiscal_requests")
        .update({
          status: steps[steps.length - 1].to,
          policy_decision: decision,
          policy_reasons: reasons,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("tenant_id", tenantId)
        .eq("status", "RECEBIDA");
      return !error;
    },

    async audit({ actorId, tenantId, requestId, status }) {
      const supabase = await createClient();
      await supabase.from("audit_log").insert({
        actor_id: actorId,
        tenant_id: tenantId,
        action: "fiscal.request_created",
        entity: "fiscal_request",
        entity_id: requestId,
        metadata: { status, simulated: true },
      });
    },
  };
}

export interface FiscalRequestSummary {
  id: string;
  status: FiscalStatus;
  createdAt: string;
  draft: NormalizedNfseDraft;
  policyReasons: string[];
}

function toSummary(row: {
  id: string;
  status: string;
  created_at: string;
  draft_snapshot: Record<string, unknown>;
  policy_reasons: string[];
}): FiscalRequestSummary {
  return {
    id: row.id,
    status: row.status as FiscalStatus,
    createdAt: row.created_at,
    draft: row.draft_snapshot as unknown as NormalizedNfseDraft,
    policyReasons: row.policy_reasons ?? [],
  };
}

/** Histórico da empresa ativa. `tenant_id` explícito além da RLS. */
export async function listFiscalRequests(
  tenantId: string,
): Promise<FiscalRequestSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiscal_requests")
    .select("id, status, created_at, draft_snapshot, policy_reasons")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(toSummary);
}

export interface FiscalRequestEvent {
  fromStatus: FiscalStatus | null;
  toStatus: FiscalStatus;
  reason: string | null;
  createdAt: string;
}

export async function getFiscalRequest(
  tenantId: string,
  requestId: string,
): Promise<(FiscalRequestSummary & { events: FiscalRequestEvent[]; simulatedReference: string | null }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiscal_requests")
    .select("id, status, created_at, draft_snapshot, policy_reasons")
    .eq("tenant_id", tenantId)
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return null;
  const { data: events } = await supabase
    .from("fiscal_request_events")
    .select("from_status, to_status, reason, created_at")
    .eq("tenant_id", tenantId)
    .eq("request_id", requestId)
    .order("id", { ascending: true });
  const { data: attempt } = await supabase
    .from("fiscal_issuance_attempts")
    .select("official_reference, simulated")
    .eq("tenant_id", tenantId)
    .eq("request_id", requestId)
    .eq("outcome", "AUTORIZADA")
    .limit(1)
    .maybeSingle();
  return {
    ...toSummary(data),
    simulatedReference: attempt?.simulated ? attempt.official_reference : null,
    events: (events ?? []).map((e) => ({
      fromStatus: e.from_status as FiscalStatus | null,
      toStatus: e.to_status as FiscalStatus,
      reason: e.reason,
      createdAt: e.created_at,
    })),
  };
}
