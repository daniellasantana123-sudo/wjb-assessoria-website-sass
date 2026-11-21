import { NextResponse, type NextRequest } from "next/server";

import { getPaymentsStatus, stripeKeysFromEnv } from "@/lib/payments/config";
import { handlePaymentEvent } from "@/lib/payments/service";
import { verifyStripeSignature } from "@/lib/payments/signature";

/**
 * Webhook da Stripe (Fase 9.1, MODO DE TESTE). Existe só com pagamentos
 * ligados e provedor `stripe_test`; fora disso, 404.
 * - assinatura conferida sobre o CORPO BRUTO, com tolerância de 5 minutos;
 * - evento live recusado;
 * - o tratador busca de novo o objeto na Stripe antes de dar acesso e
 *   ignora evento já processado (idempotência por id).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const st = getPaymentsStatus();
  if (!st.enabled || st.provider !== "stripe_test") return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await request.text();
  if (raw.length > 512_000) return NextResponse.json({ ok: false }, { status: 413 });
  const sig = verifyStripeSignature(raw, request.headers.get("stripe-signature"), stripeKeysFromEnv().webhook);
  if (!sig.ok) return NextResponse.json({ ok: false, error: sig.reason }, { status: 400 });
  let evt: { id?: unknown; type?: unknown; livemode?: unknown; data?: { object?: { id?: unknown; charge?: unknown } } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof evt.id !== "string" || typeof evt.type !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  if (evt.livemode === true) return NextResponse.json({ ok: false, error: "live recusado" }, { status: 400 });
  const obj = evt.data?.object ?? {};
  const outcome = await handlePaymentEvent({
    id: evt.id,
    type: evt.type,
    livemode: false,
    objectId: typeof obj.id === "string" ? obj.id : null,
    relatedChargeId: evt.type.startsWith("charge.dispute.") && typeof obj.charge === "string" ? obj.charge : null,
  });
  // Falha temporária devolve 500 para a Stripe tentar de novo; o resto, 200.
  return NextResponse.json({ ok: outcome !== "falhou", outcome }, { status: outcome === "falhou" ? 500 : 200 });
}
