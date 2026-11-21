import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { evaluateEmitterAuthorization } from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { resolveLayout } from "@/lib/wjb-ai/fiscal/national/layouts";
import { sortForReview } from "@/lib/wjb-ai/fiscal/review-queue";
import { evaluateFiscalReadiness } from "@/lib/wjb-ai/fiscal/profile-settings";
import {
  getWjbCertificateMetadata,
  toAuthorizationRecord,
} from "@/lib/wjb-ai/fiscal/readiness.repo";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Consultas do Admin do WJB AI. Usam o cliente do USUÁRIO da equipe: a RLS
 * da 0024 garante que só a equipe vê todas as empresas.
 */
export type AdminQueue =
  "revisao" | "prontas" | "fila" | "erros" | "concluidas" | "todas";

const QUEUE_FILTER: Record<AdminQueue, FiscalStatus[] | null> = {
  revisao: ["REVISAO_HUMANA"],
  prontas: ["CONFIRMADA"],
  fila: [
    "AUTORIZADA_PARA_ENVIO",
    "ENFILEIRADA",
    "ENVIANDO",
    "RESULTADO_INDETERMINADO",
    "CONCILIACAO_OFICIAL",
  ],
  erros: null,
  concluidas: [
    "AUTORIZADA",
    "REJEITADA",
    "BLOQUEADA",
    "DADOS_PENDENTES",
    "DOCUMENTOS_DISPONIVEIS",
    "NOTIFICADA",
  ],
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
  assignedTo: string | null;
  priority: string;
  reviewDueAt: string | null;
}

type Row = {
  id: string;
  tenant_id: string;
  status: string;
  draft_snapshot: Record<string, unknown>;
  policy_reasons: string[];
  attempt_count: number;
  needs_intervention: boolean;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  priority: string;
  review_due_at: string | null;
  tenants: { name: string } | { name: string }[] | null;
};
const SELECT =
  "id, tenant_id, status, draft_snapshot, policy_reasons, attempt_count, needs_intervention, last_error, created_at, updated_at, assigned_to, priority, review_due_at, tenants(name)";

function toRow(r: Row): AdminRequestRow {
  const tenant = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: tenant?.name ?? "—",
    status: r.status as FiscalStatus,
    draft: r.draft_snapshot as unknown as NormalizedNfseDraft,
    policyReasons: r.policy_reasons ?? [],
    attemptCount: r.attempt_count,
    needsIntervention: r.needs_intervention,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    assignedTo: r.assigned_to,
    priority: r.priority,
    reviewDueAt: r.review_due_at,
  };
}

export async function listAdminRequests(
  queue: AdminQueue,
  filters: { tenantId?: string; assignedTo?: string } = {},
): Promise<AdminRequestRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("fiscal_requests")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);
  const statuses = QUEUE_FILTER[queue];
  if (queue === "erros") q = q.eq("needs_intervention", true);
  else if (statuses) q = q.in("status", statuses);
  if (filters.tenantId) q = q.eq("tenant_id", filters.tenantId);
  if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).map(toRow);
  return queue === "revisao" ? sortForReview(rows) : rows;
}

/** Equipe ativa que pode receber revisão e nomes dos responsáveis. */
export async function listReviewStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, staff_role, status")
    .eq("is_wjb_staff", true)
    .eq("status", "active")
    .in("staff_role", ["contador", "super_admin"])
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
}

export async function listTenantsForFilter() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");
  return data ?? [];
}

export interface AdminMetrics {
  byQueue: Record<AdminQueue, number>;
  oldestWaitingMinutes: number | null;
  attemptsSimulated: number;
}

export async function getAdminMetrics(now = new Date()): Promise<AdminMetrics> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiscal_requests")
    .select("status, needs_intervention, updated_at")
    .limit(5000);
  const rows = data ?? [];
  const byQueue = Object.fromEntries(
    Object.keys(QUEUE_FILTER).map((k) => [k, 0]),
  ) as Record<AdminQueue, number>;
  let oldest: number | null = null;
  for (const r of rows) {
    byQueue.todas++;
    if (r.needs_intervention) byQueue.erros++;
    for (const [k, statuses] of Object.entries(QUEUE_FILTER) as [
      AdminQueue,
      FiscalStatus[] | null,
    ][]) {
      if (statuses?.includes(r.status as FiscalStatus)) byQueue[k]++;
    }
    if (
      QUEUE_FILTER.fila!.includes(r.status as FiscalStatus) ||
      r.status === "REVISAO_HUMANA"
    ) {
      const t = new Date(r.updated_at).getTime();
      oldest = oldest === null ? t : Math.min(oldest, t);
    }
  }
  const { count } = await supabase
    .from("fiscal_issuance_attempts")
    .select("id", { count: "exact", head: true })
    .eq("simulated", true);
  return {
    byQueue,
    oldestWaitingMinutes:
      oldest === null ? null : Math.round((now.getTime() - oldest) / 60_000),
    attemptsSimulated: count ?? 0,
  };
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

export async function getAdminRequest(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiscal_requests")
    .select(SELECT + ", created_by")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = toRow(data as unknown as Row);
  const { data: versions } = await supabase
    .from("fiscal_request_versions")
    .select("version, draft_snapshot, replaced_by, replaced_at")
    .eq("request_id", id)
    .order("version");
  const [{ data: events }, { data: attempts }] = await Promise.all([
    supabase
      .from("fiscal_request_events")
      .select(
        "from_status, to_status, reason, actor_id, actor_kind, created_at",
      )
      .eq("request_id", id)
      .order("id"),
    supabase
      .from("fiscal_issuance_attempts")
      .select(
        "environment, outcome, official_reference, rejection_code, simulated, created_at",
      )
      .eq("request_id", id)
      .order("created_at"),
  ]);
  const createdBy = (data as unknown as { created_by: string | null })
    .created_by;
  const names = await namesFor([
    ...(events ?? []).map((e) => e.actor_id ?? ""),
    createdBy ?? "",
  ]);
  const [{ data: profile }, { data: grant }] = await Promise.all([
    supabase
      .from("fiscal_profiles")
      .select("id, version")
      .eq("tenant_id", row.tenantId)
      .eq("status", "approved")
      .maybeSingle(),
    supabase
      .from("fiscal_authorization_grants")
      .select("valid_until")
      .eq("tenant_id", row.tenantId)
      .eq("status", "active")
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    ...row,
    createdByName: createdBy ? (names.get(createdBy) ?? "—") : "—",
    events: (events ?? []).map((e) => ({
      from: e.from_status as FiscalStatus | null,
      to: e.to_status as FiscalStatus,
      reason: e.reason,
      at: e.created_at,
      actor:
        e.actor_kind === "system"
          ? "Processamento automático"
          : e.actor_id
            ? (names.get(e.actor_id) ?? "—")
            : "—",
    })),
    attempts: attempts ?? [],
    versions: (versions ?? []).map((v) => ({
      version: v.version,
      draft: v.draft_snapshot as unknown as NormalizedNfseDraft,
      replacedAt: v.replaced_at,
    })),
    approvedProfileVersion: profile?.version ?? null,
    grantValidUntil: grant?.valid_until ?? null,
  };
}

export async function listFiscalSetup(today: string) {
  const supabase = await createClient();
  const [
    { data: tenants },
    { data: profiles },
    { data: grants },
    { data: series },
  ] = await Promise.all([
    supabase.from("tenants").select("id, name, cnpj, status").order("name"),
    supabase
      .from("fiscal_profiles")
      .select(
        "id, tenant_id, version, status, municipality_ibge_code, max_amount_cents_without_review, service_settings, approved_by, approved_at, approval_justification, created_at",
      )
      .order("version", { ascending: false }),
    supabase
      .from("fiscal_authorization_grants")
      .select(
        "id, tenant_id, kind, emission_model, scope, status, valid_until, evidence_reference, revoked_at, revoke_reason, certificate_holder_document, certificate_valid_from, certificate_valid_until, certificate_fingerprint_sha256, certificate_vault_reference, certificate_kind, certificate_requirements_confirmed",
      )
      .order("valid_until", { ascending: false }),
    supabase
      .from("fiscal_dps_series")
      .select(
        "tenant_id, environment, series, last_number, emitter_document, active",
      )
      .eq("active", true),
  ]);
  const names = await namesFor(
    (profiles ?? []).map((p) => p.approved_by ?? ""),
  );
  const layout = resolveLayout("producao_restrita", today);
  const wjbCertificate = getWjbCertificateMetadata();
  return (tenants ?? []).map((t) => {
    const tenantProfiles = (profiles ?? []).filter((p) => p.tenant_id === t.id);
    const tenantGrants = (grants ?? []).filter((g) => g.tenant_id === t.id);
    const tenantSeries = (series ?? []).filter((x) => x.tenant_id === t.id);
    const approved =
      tenantProfiles.find((p) => p.status === "approved") ?? null;
    const tenantDocument = (t.cnpj ?? "")
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
    const readiness = evaluateFiscalReadiness({
      profileStatus: approved ? "approved" : null,
      rawSettings: approved?.service_settings ?? null,
      tenantDocument,
      authorization: evaluateEmitterAuthorization({
        tenantDocument,
        grants: tenantGrants.map(toAuthorizationRecord),
        wjbCertificate,
        today,
      }),
      layout,
      seriesConfigured:
        tenantSeries.find((x) => x.environment === "producao_restrita")
          ?.series ?? null,
    });
    return {
      ...t,
      profiles: tenantProfiles.map((p) => ({
        ...p,
        approvedByName: p.approved_by
          ? (names.get(p.approved_by) ?? "—")
          : null,
      })),
      grants: tenantGrants,
      series: tenantSeries,
      readiness,
    };
  });
}

export async function listApproverGrants() {
  const supabase = await createClient();
  const [{ data: grants }, { data: contadores }, { data: tenants }] =
    await Promise.all([
      supabase
        .from("fiscal_profile_approver_grants")
        .select(
          "id, profile_id, tenant_id, reason, granted_by, granted_at, revoked_at, revoke_reason",
        )
        .order("granted_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("is_wjb_staff", true)
        .eq("staff_role", "contador")
        .order("full_name"),
      supabase.from("tenants").select("id, name").order("name"),
    ]);
  const names = await namesFor(
    (grants ?? []).flatMap((g) => [g.profile_id, g.granted_by]),
  );
  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  return {
    grants: (grants ?? []).map((g) => ({
      ...g,
      profileName: names.get(g.profile_id) ?? "—",
      grantedByName: names.get(g.granted_by) ?? "—",
      tenantName: g.tenant_id
        ? (tenantName.get(g.tenant_id) ?? "—")
        : "Todas as empresas",
    })),
    contadores: (contadores ?? []).filter((c) => c.status === "active"),
    tenants: tenants ?? [],
  };
}
