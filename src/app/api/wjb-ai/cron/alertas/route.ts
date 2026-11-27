import { NextResponse, type NextRequest } from "next/server";

import { notifyCertificateExpiry, notifyFiscalAlerts } from "@/lib/notifications";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { deliverExpiryNotices } from "@/lib/wjb-ai/fiscal/certificate-lifecycle.repo";
import { loadFiscalAlerts } from "@/lib/wjb-ai/fiscal/monitoring.repo";
import { isCronAuthorized } from "@/lib/security/cron-auth";

/**
 * POST /api/wjb-ai/cron/alertas (Fase 6). Avalia certificados, procurações,
 * pedidos com resultado desconhecido, fila de erros e usos negados do
 * certificado, avisos de vencimento do certificado (90/60/30/15/7 dias,
 * Fase 10C), e avisa contadores e super admin no Admin quando há alerta
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
  if (!isCronAuthorized(request.headers.get("authorization"), secret))
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
  // Fase 10C: avisos de vencimento do certificado nos marcos 90/60/30/15/7 e
  // no vencimento, uma única vez por certificado e marco.
  const expiry = await deliverExpiryNotices(notifyCertificateExpiry);
  // Só códigos e contagens: nenhum dado pessoal na resposta.
  const byCode: Record<string, number> = {};
  for (const a of alerts) byCode[a.code] = (byCode[a.code] ?? 0) + 1;
  return NextResponse.json({
    ok: true,
    total: alerts.length,
    critical: critical.length,
    expiryNotices: expiry.delivered.map((n) => n.milestone),
    expiryNoticesFailed: expiry.failed,
    ...(expiry.unavailable ? { certificateRegistry: "REGISTRO_INDISPONIVEL" } : {}),
    byCode,
  });
}
