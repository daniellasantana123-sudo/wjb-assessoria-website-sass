import { NextResponse, type NextRequest } from "next/server";

import { getFiscalProviderMode, isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { getFiscalProvider } from "@/lib/wjb-ai/fiscal/provider";
import { processQueue } from "@/lib/wjb-ai/fiscal/queue";
import { createSupabaseQueueRepo } from "@/lib/wjb-ai/fiscal/queue.repo";
import {
  currentGateState,
  requireOpenGate,
  TransmissionBlockedError,
} from "@/lib/wjb-ai/fiscal/national/transmission-gate";
import { createSupabaseGateAuditSink } from "@/lib/wjb-ai/fiscal/national/transmission-gate.repo";
import { isCronAuthorized } from "@/lib/security/cron-auth";

/**
 * POST /api/wjb-ai/cron/processar-fila (F3). Processa um lote da fila de
 * envio. Protegida pelo mesmo CRON_SECRET dos lembretes; desligada (404)
 * junto com o módulo, que é também o "STOP ALL ISSUANCE". Só aceita o
 * conector simulado nesta fase.
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
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { ok: false, error: "não autorizado" },
      { status: 401 },
    );
  }
  const mode = getFiscalProviderMode();
  if (mode !== "mock") {
    // Fase 10B: qualquer modo oficial passa pelo portão único, que audita o
    // bloqueio. Mesmo com o portão aberto, o transporte real não existe
    // nesta fase: a resposta continua 503.
    const codes: string[] = [];
    try {
      await requireOpenGate(
        currentGateState(
          mode === "producao" ? "producao" : "producao_restrita",
        ),
        createSupabaseGateAuditSink(),
        "cron/processar-fila",
      );
    } catch (e) {
      if (!(e instanceof TransmissionBlockedError)) throw e;
      codes.push(...e.blockers.map((b) => b.code));
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Só o conector simulado é permitido nesta fase.",
        blockers: codes,
      },
      { status: 503 },
    );
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
