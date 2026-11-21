import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Fase 9.1: rota do webhook da Stripe em modo `stripe_test`, rodando com
 * segredos de FORMATO gerados na hora pelo staging.sh (não são credenciais
 * da Stripe). Só testa o que não precisa chamar a Stripe: assinatura,
 * janela de tempo, livemode, idempotência e evento não tratado.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && process.env.HOMOLOG_PAYMENTS === "stripe_test_format";
test.skip(!enabled, "Só no staging com a rota de webhook ligada (staging.sh).");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const secret = () => process.env.STRIPE_WEBHOOK_SECRET ?? "";
const sign = (body: string, t = Math.floor(Date.now() / 1000), key = secret()) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
const post = (request: import("@playwright/test").APIRequestContext, body: string, sig?: string) =>
  request.post("/api/payments/stripe/webhook", { data: body, headers: { "content-type": "application/json", ...(sig ? { "stripe-signature": sig } : {}) } });

test("webhook: assinatura, janela, livemode, idempotência e evento não tratado", async ({ request }) => {
  const id = `evt_wjb_teste_${Date.now()}`;
  const body = JSON.stringify({ id, object: "event", type: "wjb.teste_nao_tratado", livemode: false, data: { object: { id: "obj_1" } } });
  expect((await post(request, body)).status()).toBe(400); // sem assinatura
  expect((await post(request, body, sign(body, undefined, "whsec_" + "0".repeat(24)))).status()).toBe(400); // segredo errado
  expect((await post(request, body + " ", sign(body))).status()).toBe(400); // corpo alterado
  expect((await post(request, body, sign(body, Math.floor(Date.now() / 1000) - 600))).status()).toBe(400); // replay antigo
  const live = JSON.stringify({ id: `${id}_live`, type: "invoice.paid", livemode: true, data: { object: { id: "in_1" } } });
  const rl = await post(request, live, sign(live));
  expect(rl.status()).toBe(400);
  const first = await post(request, body, sign(body));
  expect(await first.json()).toMatchObject({ ok: true, outcome: "ignorado" });
  const again = await post(request, body, sign(body));
  expect(await again.json()).toMatchObject({ ok: true, outcome: "repetido" });

  const admin = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  const { data } = await admin.from("payment_events").select("provider_event_id, livemode").like("provider_event_id", `${id}%`);
  expect(data).toEqual([{ provider_event_id: id, livemode: false }]); // uma linha; o live nem entrou
  await admin.from("payment_events").delete().like("provider_event_id", "evt_wjb_teste_%");
});

test("checkout simulado não existe quando o provedor é a Stripe", async ({ request }) => {
  const res = await request.get("/portal/plano/checkout-simulado/cs_mock_qualquer", { maxRedirects: 0 });
  expect([307, 404]).toContain(res.status()); // sem login redireciona; com login, 404
});
