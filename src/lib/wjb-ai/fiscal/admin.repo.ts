import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Consultas do Admin do WJB AI. Usam o cliente do USUÁRIO da equipe: a RLS
 * da 0024 garante que só a equipe vê todas as empresas.
 */
export type AdminQueue = "revisao" | "prontas" | "fila" | "erros" | "concluidas" | "todas";

const QUEUE_FILTER: Record<AdminQueue, FiscalStatus[] | null> = {
  revisao: ["REVISAO_HUMANA"],
  prontas: ["CONFIRMADA"],
  fila: ["AUTORIZADA_PARA_ENVIO", "ENFILEIRADA", "ENVIANDO", "RESULTADO_INDETERMINADO", "CONCILIACAO_OFICIAL"],
  erros: null,
  concluidas: ["AUTORIZADA", "REJEITADA", "BLOQUEADA", "DADOS_PENDENTES", "DOCUMENTOS_DISPONIVEIS", "NOTIFICADA"],
  todas: null,
};

export const ADMIN_QUEUE_LABELS: Record<AdminQueue, string> = {
  revisao: "Em revisão",
  prontas: "Prontas para envio",
  fila: "Na fila",
  erros: "Fila de erros",
  concluidas: "Concluídas",
  todas: "Todas",
};

export interface AdminRequestRow {
  id: string;
  tenantId: string;
  tenantName: string;
  status: FiscalStatus;
  draft: NormalizedNfseDraft;
  policyReasons: string[];
  attemptCount: number;
  needsIntervention: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string; tenant_id: string; status: string; draft_snapshot: Record<string, unknown>; policy_reasons: string[];
  attempt_count: number; needs_intervention: boolean; last_error: string | null; created_at: string; updated_at: string;
  tenants: { name: string } | { name: string }[] | null;
};
const SELECT = "id, tenant_id, status, draft_snapshot, policy_reasons, attempt_count, needs_intervention, last_error, created_at, updated_at, tenants(name)";

function toRow(r: Row): AdminRequestRow {
  const tenant = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
  return {
    id: r.id, tenantId: r.tenant_id, tenantName: tenant?.name ?? "—", status: r.status as FiscalStatus,
    draft: r.draft_snapshot as unknown as NormalizedNfseDraft, policyReasons: r.policy_reasons ?? [],
    attemptCount: r.attempt_count, needsIntervention: r.needs_intervention, lastError: r.last_error,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function listAdminRequests(queue: AdminQueue): Promise<AdminRequestRow[]> {
  const supabase = await createClient();
  let q = supabase.from("fiscal_requests").select(SELECT).order("updated_at", { ascending: false }).limit(200);
  const statuses = QUEUE_FILTER[queue];
  if (queue === "erros") q = q.eq("needs_intervention", true);
  else if (statuses) q = q.in("status", statuses);
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map(toRow);
}

export interface AdminMetrics {
  byQueue: Record<AdminQueue, number>;
  oldestWaitingMinutes: number | null;
  attemptsSimulated: number;
}

export async function getAdminMetrics(now = new Date()): Promise<AdminMetrics> {
  const supabase = await createClient();
  const { data } = await supabase.from("fiscal_requests").select("status, needs_intervention, updated_at").limit(5000);
  const rows = data ?? [];
  const byQueue = Object.fromEntries(Object.keys(QUEUE_FILTER).map((k) => [k, 0])) as Record<AdminQueue, number>;
  let oldest: number | null = null;
  for (const r of rows) {
    byQueue.todas++;
    if (r.needs_intervention) byQueue.erros++;
    for (const [k, statuses] of Object.entries(QUEUE_FILTER) as [AdminQueue, FiscalStatus[] | null][]) {
      if (statuses?.includes(r.status as FiscalStatus)) byQueue[k]++;
    }
    if (QUEUE_FILTER.fila!.includes(r.status as FiscalStatus) || r.status === "REVISAO_HUMANA") {
      const t = new Date(r.updated_at).getTime();
      oldest = oldest === null ? t : Math.min(oldest, t);
    }
  }
  const { count } = await supabase.from("fiscal_issuance_attempts").select("id", { count: "exact", head: true }).eq("simulated", true);
  return {
    byQueue,
    oldestWaitingMinutes: oldest === null ? null : Math.round((now.getTime() - oldest) / 60_000),
    attemptsSimulated: count ?? 0,
  };
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

export async function getAdminRequest(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("fiscal_requests").select(SELECT + ", created_by").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = toRow(data as unknown as Row);
  const [{ data: events }, { data: attempts }] = await Promise.all([
    supabase.from("fiscal_request_events").select("from_status, to_status, reason, actor_id, actor_kind, created_at").eq("request_id", id).order("id"),
    supabase.from("fiscal_issuance_attempts").select("environment, outcome, official_reference, rejection_code, simulated, created_at").eq("request_id", id).order("created_at"),
  ]);
  const createdBy = (data as unknown as { created_by: string | null }).created_by;
  const names = await namesFor([...(events ?? []).map((e) => e.actor_id ?? ""), createdBy ?? ""]);
  const [{ data: profile }, { data: grant }] = await Promise.all([
    supabase.from("fiscal_profiles").select("id, version").eq("tenant_id", row.tenantId).eq("status", "approved").maybeSingle(),
    supabase.from("fiscal_authorization_grants").select("valid_until").eq("tenant_id", row.tenantId).eq("status", "active").order("valid_until", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    ...row,
    createdByName: createdBy ? names.get(createdBy) ?? "—" : "—",
    events: (events ?? []).map((e) => ({
      from: e.from_status as FiscalStatus | null, to: e.to_status as FiscalStatus, reason: e.reason, at: e.created_at,
      actor: e.actor_kind === "system" ? "Processamento automático" : e.actor_id ? names.get(e.actor_id) ?? "—" : "—",
    })),
    attempts: attempts ?? [],
    approvedProfileVersion: profile?.version ?? null,
    grantValidUntil: grant?.valid_until ?? null,
  };
}

export async function listFiscalSetup() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: profiles }, { data: grants }] = await Promise.all([
    supabase.from("tenants").select("id, name, cnpj, status").order("name"),
    supabase.from("fiscal_profiles").select("id, tenant_id, version, status, municipality_ibge_code, max_amount_cents_without_review, approved_by, approved_at, approval_justification, created_at").order("version", { ascending: false }),
    supabase.from("fiscal_authorization_grants").select("id, tenant_id, kind, scope, status, valid_until, evidence_reference").order("valid_until", { ascending: false }),
  ]);
  const names = await namesFor((profiles ?? []).map((p) => p.approved_by ?? ""));
  return (tenants ?? []).map((t) => ({
    ...t,
    profiles: (profiles ?? []).filter((p) => p.tenant_id === t.id).map((p) => ({ ...p, approvedByName: p.approved_by ? names.get(p.approved_by) ?? "—" : null })),
    grants: (grants ?? []).filter((g) => g.tenant_id === t.id),
  }));
}

export async function listApproverGrants() {
  const supabase = await createClient();
  const [{ data: grants }, { data: contadores }, { data: tenants }] = await Promise.all([
    supabase.from("fiscal_profile_approver_grants").select("id, profile_id, tenant_id, reason, granted_by, granted_at, revoked_at, revoke_reason").order("granted_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, status").eq("is_wjb_staff", true).eq("staff_role", "contador").order("full_name"),
    supabase.from("tenants").select("id, name").order("name"),
  ]);
  const names = await namesFor((grants ?? []).flatMap((g) => [g.profile_id, g.granted_by]));
  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  return {
    grants: (grants ?? []).map((g) => ({
      ...g,
      profileName: names.get(g.profile_id) ?? "—",
      grantedByName: names.get(g.granted_by) ?? "—",
      tenantName: g.tenant_id ? tenantName.get(g.tenant_id) ?? "—" : "Todas as empresas",
    })),
    contadores: (contadores ?? []).filter((c) => c.status === "active"),
    tenants: tenants ?? [],
  };
}
