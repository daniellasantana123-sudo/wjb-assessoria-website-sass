import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/db/supabase/server";
import {
  buildMonthBuckets,
  periodRange,
  type ReportMonthRow,
  type ReportPeriod,
} from "@/lib/reports/period";
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

export interface TenantPeriodReport {
  months: ReportMonthRow[];
  totals: ReportMonthRow;
  tickets: { opened: number; closed: number; open: number };
  complianceRate: number | null;
}

/**
 * Relatório do período do Portal (2026-09-24) - o que a "Visão geral" não
 * dá: uma janela de tempo escolhida pelo cliente, chamados de suporte e um
 * recorte exportável.
 *
 * Duas datas diferentes governam este relatório, de propósito:
 * obrigação é contada pelo **vencimento** (`due_date` - é o que importa
 * num relatório fiscal), documento e chamado pela **data de criação**
 * (`created_at` - não têm vencimento). Misturar as duas produziria um
 * número que não significa nada.
 *
 * "Atrasada" é sempre medida contra HOJE, não contra o fim do período: uma
 * obrigação de março ainda pendente continua atrasada em setembro.
 */
export async function getTenantPeriodReport(
  tenantId: string,
  period: ReportPeriod,
): Promise<TenantPeriodReport> {
  const supabase = await createClient();
  const buckets = buildMonthBuckets(period);
  const { start, end } = periodRange(buckets);
  const today = new Date().toISOString().slice(0, 10);

  const [obligations, documents, ticketsOpened, ticketsOpen] = await Promise.all([
    supabase
      .from("obligations")
      .select("due_date, status")
      .eq("tenant_id", tenantId)
      .gte("due_date", start)
      .lte("due_date", end),
    supabase
      .from("documents")
      .select("created_at, category")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`),
    supabase
      .from("tickets")
      .select("status", { count: "exact" })
      .eq("tenant_id", tenantId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "closed"),
  ]);

  const months: ReportMonthRow[] = buckets.map((bucket) => {
    const inMonth = (iso: string) => {
      const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`);
      return d.getFullYear() === bucket.year && d.getMonth() === bucket.month;
    };

    const rows = (obligations.data ?? []).filter((row) => inMonth(row.due_date));
    const files = (documents.data ?? []).filter((row) => inMonth(row.created_at));

    return {
      label: bucket.label,
      obligationsTotal: rows.length,
      obligationsDone: rows.filter((row) => row.status === "done").length,
      obligationsPending: rows.filter((row) => row.status === "pending").length,
      obligationsOverdue: rows.filter(
        (row) => row.status === "pending" && row.due_date < today,
      ).length,
      documents: files.filter((row) => row.category === "documento").length,
      guias: files.filter((row) => row.category === "guia").length,
    };
  });

  const totals = months.reduce<ReportMonthRow>(
    (acc, row) => ({
      label: "Total",
      obligationsTotal: acc.obligationsTotal + row.obligationsTotal,
      obligationsDone: acc.obligationsDone + row.obligationsDone,
      obligationsPending: acc.obligationsPending + row.obligationsPending,
      obligationsOverdue: acc.obligationsOverdue + row.obligationsOverdue,
      documents: acc.documents + row.documents,
      guias: acc.guias + row.guias,
    }),
    {
      label: "Total",
      obligationsTotal: 0,
      obligationsDone: 0,
      obligationsPending: 0,
      obligationsOverdue: 0,
      documents: 0,
      guias: 0,
    },
  );

  const ticketRows = ticketsOpened.data ?? [];

  return {
    months,
    totals,
    tickets: {
      opened: ticketsOpened.count ?? 0,
      closed: ticketRows.filter((row) => row.status === "closed").length,
      open: ticketsOpen.count ?? 0,
    },
    // Sem nenhuma obrigação no período não existe taxa - `null` em vez de
    // 0%, que leria como "não cumpriu nada".
    complianceRate:
      totals.obligationsTotal > 0
        ? Math.round((totals.obligationsDone / totals.obligationsTotal) * 100)
        : null,
  };
}
