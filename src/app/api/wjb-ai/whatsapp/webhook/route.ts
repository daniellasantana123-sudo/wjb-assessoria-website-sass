import { NextResponse, type NextRequest } from "next/server";

import { isCommercialEnabled } from "@/lib/commercial/config";
import { isRateLimited } from "@/lib/security/rate-limit";
import {
  parseWebhookPayload,
  ReplayGuard,
  verifyWebhookSignature,
} from "@/lib/whatsapp/provider";

/**
 * Webhook do WhatsApp em MODO SIMULADO (Fase 8). Só existe com a
 * comercialização E `WJB_WHATSAPP_MOCK_ENABLED=true`; fora disso, 404.
 * Não está registrado na Meta e não recebe tráfego real. Confere assinatura,
 * janela de tempo e repetição; não guarda conteúdo de mensagem nem telefone.
 */
const guard = new ReplayGuard();
const enabled = () => isCommercialEnabled() && process.env["WJB_WHATSAPP_MOCK_ENABLED"] === "true";
const notFound = () => NextResponse.json({ ok: false }, { status: 404 });

export async function GET(request: NextRequest) {
  if (!enabled()) return notFound();
  const p = request.nextUrl.searchParams;
  const token = process.env["WJB_WHATSAPP_MOCK_VERIFY_TOKEN"];
  if (p.get("hub.mode") === "subscribe" && token && p.get("hub.verify_token") === token)
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: NextRequest) {
  if (!enabled()) return notFound();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(`wa-webhook:${ip}`, 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ ok: false }, { status: 413 });
  const secret = process.env["WJB_WHATSAPP_MOCK_APP_SECRET"] ?? "";
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), secret))
    return NextResponse.json({ ok: false, error: "assinatura inválida" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const counts = { novo: 0, repetido: 0, fora_da_janela: 0 };
  for (const ev of parseWebhookPayload(payload)) counts[guard.accept(ev, now)]++;
  return NextResponse.json({ ok: true, simulated: true, ...counts });
}
