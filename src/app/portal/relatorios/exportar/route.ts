import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/dal";
import { buildReportCsv, resolvePeriod } from "@/lib/reports/period";
import { getActiveTenant, getTenantPeriodReport } from "@/lib/tenant";

/**
 * Exportação do relatório do período em CSV (2026-09-24).
 *
 * `requireSession()` + `getActiveTenant()` são a mesma porta usada pela
 * página: o CSV nunca aceita um `tenantId` pela URL, senão bastaria trocar
 * o id para baixar o relatório de outra empresa. A empresa sai da sessão,
 * e a RLS do banco continua valendo por baixo como segunda barreira.
 */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);

  if (!tenant) {
    return NextResponse.redirect(new URL("/portal/relatorios", request.url));
  }

  const period = resolvePeriod(
    request.nextUrl.searchParams.get("periodo") ?? undefined,
  );
  const report = await getTenantPeriodReport(tenant.id, period);
  const csv = buildReportCsv([...report.months, report.totals]);

  // Nome do arquivo derivado da empresa e do período, sem acento nem
  // espaço - alguns navegadores e o Excel tropeçam nisso ao salvar.
  const slug = tenant.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const fileName = `relatorio-${slug || "empresa"}-${period.value}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Relatório é dado do cliente: nunca deve ficar em cache de proxy.
      "Cache-Control": "no-store",
    },
  });
}
