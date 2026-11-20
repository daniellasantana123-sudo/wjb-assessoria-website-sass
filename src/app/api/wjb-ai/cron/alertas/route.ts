import { NextResponse, type NextRequest } from "next/server";

import { notifyFiscalAlerts } from "@/lib/notifications";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { loadFiscalAlerts } from "@/lib/wjb-ai/fiscal/monitoring.repo";

/**
 * POST /api/wjb-ai/cron/alertas (Fase 6). Avalia certificados, procurações,
 * pedidos com resultado desconhecido, fila de erros e usos negados do
 * certificado, e avisa contadores e super admin no Admin quando há alerta
 * crítico. Mesmo CRON_SECRET da fila; desligada (404) junto com o módulo.
 * Não agendada nesta fase (agendar exige aprovação da WJB).
 */
export async function POST(request: NextRequest) {
  if (!isWjbAiEnabled())
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  const secret = process.env["CRON_SECRET"];
  if (!secret)
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET não configurado" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json(
      { ok: false, error: "não autorizado" },
      { status: 401 },
    );

  const alerts = await loadFiscalAlerts();
  const critical = alerts.filter((a) => a.severity === "critico");
  if (critical.length)
    await notifyFiscalAlerts({
      critical: critical.length,
      total: alerts.length,
    });
  // Só códigos e contagens: nenhum dado pessoal na resposta.
  const byCode: Record<string, number> = {};
  for (const a of alerts) byCode[a.code] = (byCode[a.code] ?? 0) + 1;
  return NextResponse.json({
    ok: true,
    total: alerts.length,
    critical: critical.length,
    byCode,
  });
}
