import "server-only";

import { cycleFor } from "@/lib/commercial/pricing";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { toIsoDate } from "@/lib/reports/period";
import { notifyFiscalRequestEvent } from "@/lib/notifications";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import type { QueueJob, QueueRepo } from "@/lib/wjb-ai/fiscal/queue";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

const QUEUE_STATES: FiscalStatus[] = [
  "AUTORIZADA_PARA_ENVIO",
  "CONCILIACAO_OFICIAL",
];

/** Repositório da fila: só o servidor (service role) escreve. */
/**
 * Consumo SIMULADO no ledger comercial (Fase 8): uma linha por pedido, nunca
 * faturável (o banco recusa). Sem a migration 0030, ou sem assinatura, segue
 * sem registrar: consumo nunca bloqueia o processamento da fila.
 */
async function recordSimulatedUsage(tenantId: string, requestId: string) {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("commercial_subscriptions")
      .select("id, cycle_start")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelada")
      .maybeSingle();
    const cycleStart = sub?.cycle_start ?? cycleFor(toIsoDate(new Date())).start;
    await admin
      .from("commercial_usage_ledger")
      .upsert(
        { tenant_id: tenantId, subscription_id: sub?.id ?? null, request_id: requestId, kind: "simulada", billable: false, cycle_start: cycleStart },
        { onConflict: "request_id,kind", ignoreDuplicates: true },
      );
  } catch {
    /* sem tabela comercial neste ambiente: não registra */
  }
}

export function createSupabaseQueueRepo(
  environment: "mock" | "homologacao" | "producao",
): QueueRepo {
  const admin = createAdminClient();
  return {
    async claimDue(now, limit) {
      const { data } = await admin
        .from("fiscal_requests")
        .select(
          "id, tenant_id, status, idempotency_key, draft_snapshot, attempt_count, next_attempt_at",
        )
        .in("status", QUEUE_STATES)
        .eq("needs_intervention", false)
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
        .order("updated_at", { ascending: true })
        .limit(limit);
      return (data ?? []).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        status: r.status as FiscalStatus,
        idempotencyKey: r.idempotency_key,
        draft: r.draft_snapshot as unknown as NormalizedNfseDraft,
        attemptCount: r.attempt_count,
      }));
    },

    async transition(job: QueueJob, from, to, reason) {
      // Atualização condicional: só muda se ainda estiver em `from`.
      const { data } = await admin
        .from("fiscal_requests")
        .update({ status: to, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("tenant_id", job.tenantId)
        .eq("status", from)
        .select("id");
      if (!data?.length) return false;
      await admin.from("fiscal_request_events").insert({
        request_id: job.id,
        tenant_id: job.tenantId,
        from_status: from === to ? null : from,
        to_status: to,
        actor_kind: "system",
        reason,
      });
      return true;
    },

    async recordAttempt(job, outcome) {
      await admin.from("fiscal_issuance_attempts").insert({
        request_id: job.id,
        tenant_id: job.tenantId,
        environment,
        idempotency_key: job.idempotencyKey,
        outcome: outcome.status,
        official_reference:
          outcome.status === "AUTORIZADA" ? outcome.officialId : null,
        rejection_code:
          outcome.status === "REJEITADA" ? outcome.rejectionCode : null,
        simulated: outcome.simulated,
      });
    },

    async hasAuthorizedAttempt(job) {
      const { count } = await admin
        .from("fiscal_issuance_attempts")
        .select("id", { count: "exact", head: true })
        .eq("request_id", job.id)
        .eq("outcome", "AUTORIZADA");
      return (count ?? 0) > 0;
    },

    async notifyOutcome(job, outcome, simulated) {
      if (!simulated) return; // Resultado oficial terá aviso próprio quando houver conector real.
      if (outcome === "AUTORIZADA") await recordSimulatedUsage(job.tenantId, job.id);
      await notifyFiscalRequestEvent({
        tenantId: job.tenantId,
        actorId: null,
        requestId: job.id,
        kind:
          outcome === "AUTORIZADA"
            ? "authorized_simulated"
            : "rejected_simulated",
      });
    },

    async scheduleRetry(job, attemptCount, nextAttemptAt, error, intervention) {
      await admin
        .from("fiscal_requests")
        .update({
          attempt_count: attemptCount,
          next_attempt_at: nextAttemptAt.toISOString(),
          last_error: error,
          needs_intervention: intervention,
        })
        .eq("id", job.id)
        .eq("tenant_id", job.tenantId);
    },
  };
}
