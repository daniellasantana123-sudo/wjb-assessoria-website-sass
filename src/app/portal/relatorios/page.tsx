import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardCheck,
  Download,
  FileText,
  LifeBuoy,
  Percent,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { PortalStatCard } from "@/components/portal/portal-stat-card";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";
import { reportPeriods, resolvePeriod } from "@/lib/reports/period";
import { getActiveTenant, getTenantPeriodReport } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Relatórios",
  robots: { index: false, follow: false },
};

/**
 * Relatórios e indicadores do Portal (2026-09-24) - último item que ainda
 * estava "Planejado" em `src/config/digital-accounting.ts`.
 *
 * **Escopo deliberadamente operacional, não financeiro.** O banco não
 * guarda nenhum valor em reais: `obligations` tem título, vencimento e
 * status, mas não tem montante, e `documents` é só arquivo. Faturamento,
 * impostos pagos e DRE dependem de uma fonte de dados que ainda não
 * existe (decisão do usuário em 2026-09-24: virá de integração com o ERP,
 * numa fase seguinte). Até lá, nenhum número financeiro aparece aqui -
 * inventar seria exatamente o que a seção 43 proíbe.
 *
 * O que esta tela acrescenta à "Visão geral" (que já mostra contagens do
 * momento): período escolhido pelo cliente, chamados de suporte - que não
 * aparecem em nenhum outro indicador - e exportação em CSV.
 */
export default async function PortalRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);
  const { periodo } = await searchParams;
  const period = resolvePeriod(periodo);

  if (!tenant) {
    return (
      <Container className="flex flex-1 flex-col gap-6 py-10">
        <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Relatórios" }]} />
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, os relatórios aparecem aqui.
          </p>
        </div>
      </Container>
    );
  }

  const report = await getTenantPeriodReport(tenant.id, period);
  const hasData =
    report.totals.obligationsTotal > 0 ||
    report.totals.documents > 0 ||
    report.totals.guias > 0 ||
    report.tickets.opened > 0;

  return (
    <Container className="flex flex-1 flex-col gap-6 py-10">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Relatórios" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Relatórios e indicadores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tenant.name} · {period.label.toLowerCase()}
          </p>
        </div>
        <Link
          href={`/portal/relatorios/exportar?periodo=${period.value}`}
          prefetch={false}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Exportar CSV
        </Link>
      </div>

      <nav aria-label="Período do relatório" className="flex flex-wrap gap-2">
        {reportPeriods.map((option) => {
          const active = option.value === period.value;
          return (
            <Link
              key={option.value}
              href={`/portal/relatorios?periodo=${option.value}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-primary rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PortalStatCard
          icon={ClipboardCheck}
          label="Obrigações no período"
          value={report.totals.obligationsTotal}
          note={
            report.totals.obligationsOverdue > 0
              ? `${report.totals.obligationsOverdue} atrasada${report.totals.obligationsOverdue === 1 ? "" : "s"}`
              : "Nenhuma atrasada"
          }
          noteTone={report.totals.obligationsOverdue > 0 ? "danger" : "success"}
        />
        <PortalStatCard
          icon={Percent}
          label="Cumprimento"
          value={report.complianceRate === null ? "-" : `${report.complianceRate}%`}
          note={
            report.complianceRate === null
              ? "sem obrigações no período"
              : `${report.totals.obligationsDone} de ${report.totals.obligationsTotal} concluídas`
          }
        />
        <PortalStatCard
          icon={FileText}
          label="Documentos e guias"
          value={report.totals.documents + report.totals.guias}
          note={`${report.totals.guias} guia${report.totals.guias === 1 ? "" : "s"} de pagamento`}
        />
        <PortalStatCard
          icon={LifeBuoy}
          label="Chamados abertos"
          value={report.tickets.opened}
          note={
            report.tickets.open > 0
              ? `${report.tickets.open} ainda em aberto`
              : "Nenhum em aberto"
          }
          noteTone={report.tickets.open > 0 ? "neutral" : "success"}
        />
      </div>

      <div className="border-border bg-background overflow-hidden rounded-md border">
        <div className="border-border border-b px-6 py-4">
          <h2 className="text-foreground text-sm font-semibold">Mês a mês</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Obrigações contadas pela data de vencimento; documentos e guias, pela data de
            envio.
          </p>
        </div>
        {!hasData ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            Nenhum registro no período selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs tracking-wide uppercase">
                  <th scope="col" className="px-6 py-3 font-medium">Mês</th>
                  <th scope="col" className="px-6 py-3 font-medium">Obrigações</th>
                  <th scope="col" className="px-6 py-3 font-medium">Concluídas</th>
                  <th scope="col" className="px-6 py-3 font-medium">Atrasadas</th>
                  <th scope="col" className="px-6 py-3 font-medium">Documentos</th>
                  <th scope="col" className="px-6 py-3 font-medium">Guias</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {report.months.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-6 py-3 text-left font-medium">
                      {row.label}
                    </th>
                    <td className="text-muted-foreground px-6 py-3 tabular-nums">
                      {row.obligationsTotal}
                    </td>
                    <td className="text-muted-foreground px-6 py-3 tabular-nums">
                      {row.obligationsDone}
                    </td>
                    <td
                      className={cn(
                        "px-6 py-3 tabular-nums",
                        row.obligationsOverdue > 0 ? "text-danger font-medium" : "text-muted-foreground",
                      )}
                    >
                      {row.obligationsOverdue}
                    </td>
                    <td className="text-muted-foreground px-6 py-3 tabular-nums">{row.documents}</td>
                    <td className="text-muted-foreground px-6 py-3 tabular-nums">{row.guias}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-border border-t">
                <tr className="text-foreground font-medium">
                  <th scope="row" className="px-6 py-3 text-left">Total</th>
                  <td className="px-6 py-3 tabular-nums">{report.totals.obligationsTotal}</td>
                  <td className="px-6 py-3 tabular-nums">{report.totals.obligationsDone}</td>
                  <td className="px-6 py-3 tabular-nums">{report.totals.obligationsOverdue}</td>
                  <td className="px-6 py-3 tabular-nums">{report.totals.documents}</td>
                  <td className="px-6 py-3 tabular-nums">{report.totals.guias}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Os números vêm do que já está registrado na plataforma. Indicadores financeiros
        (faturamento, impostos, comparativos) dependem da integração com o sistema contábil e
        ainda não estão disponíveis.
      </p>
    </Container>
  );
}
