import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FileText, Receipt, Users } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { ObligationsMonthlyChart } from "@/components/portal/obligations-monthly-chart";
import { PortalStatCard } from "@/components/portal/portal-stat-card";
import { OmiePortalCta } from "@/components/portal/omie-portal-cta";
import { requireSession } from "@/lib/auth/dal";
import {
  getActiveTenant,
  getDocumentsCategorySummary,
  getObligationsMonthlyBreakdown,
  getTenantDashboardStats,
  getUpcomingObligations,
} from "@/lib/tenant";
import { getOmieMapping } from "@/lib/omie-gclick";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
};

const monthNames = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Dashboard real do Portal do Cliente (SAAS FASE 2, redesenhado em
 * 2026-09-16 no estilo de app financeiro sob medida pro usuário — sidebar
 * própria em `portal/layout.tsx`, cards/gráfico/tabela aqui). Tudo o que
 * aparece é contagem real (regra de dados, seção 43): sem "vs. mês
 * passado" nem tendência inventada — o gráfico usa `due_date` de verdade,
 * a barra de cumprimento usa `done`/`total` reais do mês atual.
 */
export default async function PortalPage() {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);

  if (!tenant) {
    return (
      <Container className="flex flex-1 flex-col gap-6 py-10">
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, o painel aparece aqui.
          </p>
        </div>
      </Container>
    );
  }

  const [stats, months, upcoming, categories, omieMapping, omieEnabled] = await Promise.all([
    getTenantDashboardStats(tenant.id),
    getObligationsMonthlyBreakdown(tenant.id),
    getUpcomingObligations(tenant.id, 5),
    getDocumentsCategorySummary(tenant.id),
    getOmieMapping(tenant.id),
    isFeatureEnabled("omie_gclick"),
  ]);

  const now = new Date();
  const currentMonth = months.find((m) => m.isCurrent);

  return (
    <Container className="flex flex-1 flex-col gap-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Painel de {monthNames[now.getMonth()]} de {now.getFullYear()} · {stats.obligationsPending}{" "}
            obrigação{stats.obligationsPending === 1 ? "" : "ões"} pendente
            {stats.obligationsPending === 1 ? "" : "s"} · {stats.documentsCount + stats.guiasCount}{" "}
            documento{stats.documentsCount + stats.guiasCount === 1 ? "" : "s"} no total
          </p>
        </div>
        <OmiePortalCta mapping={omieMapping} featureEnabled={omieEnabled} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PortalStatCard
          icon={ClipboardCheck}
          label="Obrigações pendentes"
          value={stats.obligationsPending}
          note={
            stats.obligationsOverdue > 0
              ? `${stats.obligationsOverdue} atrasada${stats.obligationsOverdue === 1 ? "" : "s"}`
              : "Em dia"
          }
          noteTone={stats.obligationsOverdue > 0 ? "danger" : "success"}
        />
        <PortalStatCard
          icon={FileText}
          label="Documentos"
          value={stats.documentsCount}
          note="arquivos enviados"
        />
        <PortalStatCard
          icon={Receipt}
          label="Guias"
          value={stats.guiasCount}
          note="guias de pagamento"
        />
        <PortalStatCard
          icon={Users}
          label="Pessoas"
          value={stats.membersCount}
          note="com acesso ao Portal"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border-border bg-background rounded-md border p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Obrigações por mês</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                2 meses anteriores, mês atual e 3 meses seguintes
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-primary h-2 w-2 rounded-full" aria-hidden="true" />
                <span className="text-muted-foreground">Concluída</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-primary/25 h-2 w-2 rounded-full" aria-hidden="true" />
                <span className="text-muted-foreground">Pendente</span>
              </span>
            </div>
          </div>
          <div className="mt-6">
            <ObligationsMonthlyChart months={months} />
          </div>
        </div>

        <div className="border-border bg-background rounded-md border p-6">
          <h2 className="text-foreground text-sm font-semibold">Cumprimento do mês</h2>
          {currentMonth && currentMonth.total > 0 ? (
            <>
              <p className="text-foreground mt-3 text-3xl font-semibold tabular-nums">
                {currentMonth.done}
                <span className="text-muted-foreground text-lg font-normal"> de {currentMonth.total}</span>
              </p>
              <p className="text-muted-foreground mt-1 text-sm">obrigações concluídas este mês</p>
              <div className="bg-muted mt-4 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.round((currentMonth.done / currentMonth.total) * 100)}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {Math.round((currentMonth.done / currentMonth.total) * 100)}% concluído
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              Nenhuma obrigação com vencimento neste mês.
            </p>
          )}

          <div className="border-border mt-5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium uppercase">Empresa</p>
            <p className="text-foreground mt-1 text-sm font-medium">{tenant.name}</p>
            {tenant.cnpj && <p className="text-muted-foreground text-sm">{tenant.cnpj}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border-border bg-background overflow-hidden rounded-md border lg:col-span-2">
          <div className="border-border flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-foreground text-sm font-semibold">Documentos por categoria</h2>
            <Link
              href="/portal/documentos"
              className="text-primary focus-visible:ring-primary rounded-md text-xs font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Ver documentos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs tracking-wide uppercase">
                  <th className="px-6 py-3 font-medium">Categoria</th>
                  <th className="px-6 py-3 font-medium">Arquivos</th>
                  <th className="px-6 py-3 font-medium">Último envio</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {categories.map((cat) => (
                  <tr key={cat.category}>
                    <td className="px-6 py-3 font-medium">{cat.label}</td>
                    <td className="text-muted-foreground px-6 py-3 tabular-nums">{cat.count}</td>
                    <td className="text-muted-foreground px-6 py-3">
                      {cat.lastUploadAt
                        ? new Date(cat.lastUploadAt).toLocaleDateString("pt-BR")
                        : "Nenhum envio ainda"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-border bg-background overflow-hidden rounded-md border">
          <div className="border-border flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-foreground text-sm font-semibold">Próximas obrigações</h2>
            <Link
              href="/portal/obrigacoes"
              className="text-primary focus-visible:ring-primary rounded-md text-xs font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Ver todas
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Nenhuma obrigação pendente.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {upcoming.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge tone={item.overdue ? "danger" : "neutral"} className="shrink-0">
                    {item.overdue ? "Atrasada" : "Pendente"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Container>
  );
}
