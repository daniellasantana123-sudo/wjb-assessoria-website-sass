import { NextResponse, type NextRequest } from "next/server";

import { getFiscalProviderMode, isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { getFiscalProvider } from "@/lib/wjb-ai/fiscal/provider";
import { processQueue } from "@/lib/wjb-ai/fiscal/queue";
import { createSupabaseQueueRepo } from "@/lib/wjb-ai/fiscal/queue.repo";

/**
 * POST /api/wjb-ai/cron/processar-fila (F3). Processa um lote da fila de
 * envio. Protegida pelo mesmo CRON_SECRET dos lembretes; desligada (404)
 * junto com o módulo, que é também o "STOP ALL ISSUANCE". Só aceita o
 * conector simulado nesta fase.
 */
export async function POST(request: NextRequest) {
  if (!isWjbAiEnabled()) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const secret = process.env["CRON_SECRET"];
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }
  const mode = getFiscalProviderMode();
  if (mode !== "mock") {
    return NextResponse.json({ ok: false, error: "Só o conector simulado é permitido nesta fase." }, { status: 503 });
  }

  const summary = await processQueue({
    moduleEnabled: true,
    repo: createSupabaseQueueRepo(mode),
    provider: getFiscalProvider(),
    now: new Date(),
    limit: 10,
  });
  return NextResponse.json({ ok: true, simulated: true, ...summary });
}
