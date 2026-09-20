import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/db/supabase/server";
import type { TenantMemberRole } from "@/types/database";

export interface MyOrganization {
  id: string;
  name: string;
  cnpj: string;
  role: TenantMemberRole;
}

/**
 * Todas as empresas vinculadas ao usuário com vínculo ativo (não só a
 * primeira) — base do organization switcher (Fase 2 do wjb-saas-mvp,
 * 2026-09-20). Um vínculo `suspended` (ver migration 0016) não aparece
 * aqui — a pessoa não deveria nem ver essa empresa como opção pra trocar,
 * já que `getTenantRole()` bloquearia o acesso mesmo se ela trocasse.
 *
 * Substituiu `getMyPrimaryTenant()` (removida — ficou sem nenhum uso depois
 * que todas as páginas do Portal passaram a usar `getActiveTenant()`).
 */
export async function getMyOrganizations(userId: string): Promise<MyOrganization[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenants(id, name, cnpj)")
    .eq("profile_id", userId)
    .eq("status", "active");

  return (data ?? [])
    .map((row) => {
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
      if (!tenant) return null;
      return { id: tenant.id, name: tenant.name, cnpj: tenant.cnpj, role: row.role };
    })
    .filter((org): org is MyOrganization => org !== null);
}

export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

/**
 * Empresa ATIVA do usuário (Fase 2 do wjb-saas-mvp, 2026-09-20 — organization
 * switcher). O cookie é só uma preferência — nunca é confiado sozinho: toda
 * leitura revalida contra as empresas reais do usuário (`getMyOrganizations`),
 * então trocar o valor do cookie manualmente no browser não dá acesso a
 * nenhuma empresa que a pessoa não seja de fato membro. Sem cookie válido,
 * cai na primeira empresa (mesmo comportamento de antes do switcher existir).
 */
export async function getActiveTenant(userId: string): Promise<MyOrganization | null> {
  const organizations = await getMyOrganizations(userId);
  if (organizations.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  const active = activeId ? organizations.find((org) => org.id === activeId) : undefined;

  return active ?? organizations[0];
}

export interface TenantDashboardStats {
  obligationsPending: number;
  obligationsOverdue: number;
  documentsCount: number;
  guiasCount: number;
  membersCount: number;
}

/** Resumo real pro dashboard do Portal — nada aqui é inventado, só contagens. */
export async function getTenantDashboardStats(tenantId: string): Promise<TenantDashboardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [pending, overdue, documents, guias, members] = await Promise.all([
    supabase
      .from("obligations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    supabase
      .from("obligations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .lt("due_date", today),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("category", "documento"),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("category", "guia"),
    supabase
      .from("tenant_members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  return {
    obligationsPending: pending.count ?? 0,
    obligationsOverdue: overdue.count ?? 0,
    documentsCount: documents.count ?? 0,
    guiasCount: guias.count ?? 0,
    membersCount: members.count ?? 0,
  };
}

export interface UpcomingObligation {
  id: string;
  title: string;
  dueDate: string;
  status: "pending" | "done";
  overdue: boolean;
}

/** As próximas obrigações por prazo (atrasadas primeiro, por ordenação natural de data). */
export async function getUpcomingObligations(
  tenantId: string,
  limit = 5,
): Promise<UpcomingObligation[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("obligations")
    .select("id, title, due_date, status")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    status: row.status,
    overdue: row.due_date < today,
  }));
}

export interface MonthlyObligationCount {
  year: number;
  month: number;
  label: string;
  total: number;
  done: number;
  isCurrent: boolean;
}

/**
 * Obrigações por mês (2 meses passados + mês atual + 3 meses futuros — o
 * horizonte relevante pra planejamento fiscal de curto prazo). Sempre
 * conta real (nunca uma tendência inventada): meses sem nenhuma obrigação
 * cadastrada aparecem com 0, não são omitidos.
 */
export async function getObligationsMonthlyBreakdown(
  tenantId: string,
): Promise<MonthlyObligationCount[]> {
  const supabase = await createClient();

  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let offset = -2; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const rangeStart = new Date(months[0].year, months[0].month, 1);
  const rangeEnd = new Date(months[months.length - 1].year, months[months.length - 1].month + 1, 0);

  const { data } = await supabase
    .from("obligations")
    .select("due_date, status")
    .eq("tenant_id", tenantId)
    .gte("due_date", rangeStart.toISOString().slice(0, 10))
    .lte("due_date", rangeEnd.toISOString().slice(0, 10));

  const monthLabels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  return months.map(({ year, month }) => {
    const rows = (data ?? []).filter((row) => {
      const d = new Date(row.due_date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      year,
      month,
      label: monthLabels[month],
      total: rows.length,
      done: rows.filter((row) => row.status === "done").length,
      isCurrent: year === now.getFullYear() && month === now.getMonth(),
    };
  });
}

export interface DocumentCategorySummary {
  category: "documento" | "guia";
  label: string;
  count: number;
  lastUploadAt: string | null;
}

/** Documentos x Guias — contagem e envio mais recente de cada categoria, sempre real. */
export async function getDocumentsCategorySummary(
  tenantId: string,
): Promise<DocumentCategorySummary[]> {
  const supabase = await createClient();

  const categories: { value: "documento" | "guia"; label: string }[] = [
    { value: "documento", label: "Documentos" },
    { value: "guia", label: "Guias" },
  ];

  const results = await Promise.all(
    categories.map(async ({ value, label }) => {
      const { data, count } = await supabase
        .from("documents")
        .select("created_at", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("category", value)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        category: value,
        label,
        count: count ?? 0,
        lastUploadAt: data?.[0]?.created_at ?? null,
      };
    }),
  );

  return results;
}
