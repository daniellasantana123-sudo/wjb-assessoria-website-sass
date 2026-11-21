import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkStripeKeys, getPaymentsStatus, isLivePaymentsEnabled, STRIPE_API_VERSION } from "@/lib/payments/config";
import { mapInvoiceStatus, mapSubscriptionStatus, nextStatus, planUsageCharges, priceLookupKey, sessionIsPaid } from "@/lib/payments/mapping";
import { signStripePayload, verifyStripeSignature } from "@/lib/payments/signature";
import { encodeForm, StripeApiError, StripeTestProvider } from "@/lib/payments/stripe-provider";
import { canConsume } from "@/lib/commercial/pricing";

// Valores de FORMATO apenas: não são chaves reais.
const SK = "sk_test_" + "a".repeat(24);
const WH = "whsec_" + "b".repeat(24);

describe("assinatura do webhook (Stripe-Signature)", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const t = 1_800_000_000;
  it("aceita assinatura correta, inclusive com entradas extras e fora de ordem", () => {
    const h = signStripePayload(body, WH, t);
    expect(verifyStripeSignature(body, h, WH, t)).toEqual({ ok: true, timestamp: t });
    const v1 = h.split(",v1=")[1];
    expect(verifyStripeSignature(body, `v0=abc,v1=${"0".repeat(64)},destination=we_x,t=${t},v1=${v1}`, WH, t).ok).toBe(true);
  });
  it("recusa corpo alterado, segredo errado, cabeçalho ausente e requisição antiga (replay)", () => {
    const h = signStripePayload(body, WH, t);
    expect(verifyStripeSignature(body + " ", h, WH, t)).toEqual({ ok: false, reason: "assinatura_invalida" });
    expect(verifyStripeSignature(body, h, "whsec_" + "c".repeat(24), t).ok).toBe(false);
    expect(verifyStripeSignature(body, null, WH, t)).toEqual({ ok: false, reason: "cabecalho_invalido" });
    expect(verifyStripeSignature(body, `t=${t}`, WH, t)).toEqual({ ok: false, reason: "cabecalho_invalido" });
    expect(verifyStripeSignature(body, h, WH, t + 301)).toEqual({ ok: false, reason: "fora_da_janela" });
  });
});

describe("chaves e modo", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("recusa qualquer chave live e exige teste", () => {
    expect(checkStripeKeys({ secret: "sk_live_" + "x".repeat(24), publishable: "", webhook: WH }).problems[0]).toMatch(/PRODUÇÃO/);
    expect(checkStripeKeys({ secret: SK, publishable: "pk_live_" + "x".repeat(24), webhook: WH }).ok).toBe(false);
    expect(checkStripeKeys({ secret: SK, publishable: "", webhook: "" }).ok).toBe(false);
    expect(checkStripeKeys({ secret: SK, publishable: "pk_test_" + "x".repeat(24), webhook: WH }).ok).toBe(true);
    expect(checkStripeKeys({ secret: "rk_test_" + "x".repeat(24), publishable: "", webhook: WH }).ok).toBe(true);
  });
  it("desligado por padrão; stripe_test com chave live fica desligado; live nunca", () => {
    expect(getPaymentsStatus().enabled).toBe(false);
    vi.stubEnv("WJB_COMMERCIAL_ENABLED", "true");
    vi.stubEnv("WJB_PAYMENTS_ENABLED", "true");
    expect(getPaymentsStatus()).toMatchObject({ enabled: true, provider: "mock" });
    vi.stubEnv("WJB_PAYMENTS_PROVIDER", "stripe_test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_" + "x".repeat(24));
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WH);
    expect(getPaymentsStatus()).toMatchObject({ enabled: false, provider: "stripe_test" });
    expect(isLivePaymentsEnabled()).toBe(false);
  });
});

describe("cliente REST da Stripe (sem rede: fetch falso)", () => {
  function fakeFetch(reply: unknown, status = 200) {
    return vi.fn(async (...args: [string, RequestInit?]) => (void args, new Response(JSON.stringify(reply), { status })));
  }
  it("não aceita chave live no construtor", () => {
    expect(() => new StripeTestProvider("sk_live_" + "x".repeat(24), fakeFetch({}) as unknown as typeof fetch)).toThrow(/desligada/);
  });
  it("assinatura: modo subscription, preço do servidor, idioma, versão fixa e chave de idempotência; sem lista fixa de meios", async () => {
    const f = fakeFetch({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const p = new StripeTestProvider(SK, f as unknown as typeof fetch);
    await p.createCheckoutSession({ kind: "subscription", customerId: "cus_1", priceId: "price_1", successUrl: "https://h/s", cancelUrl: "https://h/c", clientReferenceId: "ck1", metadata: { wjb_tenant: "t1" }, idempotencyKey: "checkout:ck1" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const h = init!.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${SK}`);
    expect(h["Stripe-Version"]).toBe(STRIPE_API_VERSION);
    expect(h["Idempotency-Key"]).toBe("checkout:ck1");
    const body = decodeURIComponent(String(init!.body));
    expect(body).toContain("mode=subscription");
    expect(body).toContain("line_items[0][price]=price_1");
    expect(body).toContain("locale=pt-BR");
    expect(body).toContain("client_reference_id=ck1");
    expect(body).not.toContain("payment_method_types"); // meios (cartão, Link) vêm do Dashboard
  });
  it("nota avulsa: modo setup em BRL (nada é cobrado)", async () => {
    const f = fakeFetch({ id: "cs_test_2", url: "https://checkout.stripe.com/x" });
    await new StripeTestProvider(SK, f as unknown as typeof fetch).createCheckoutSession({ kind: "setup", customerId: "cus_1", priceId: null, successUrl: "s", cancelUrl: "c", clientReferenceId: "ck2", metadata: {}, idempotencyKey: "k" });
    const body = decodeURIComponent(String(f.mock.calls[0][1]!.body));
    expect(body).toContain("mode=setup");
    expect(body).toContain("currency=brl");
    expect(body).not.toContain("line_items");
  });
  it("recusa objeto live vindo da API e não expõe corpo de erro", async () => {
    await expect(new StripeTestProvider(SK, fakeFetch({ id: "sub_1", livemode: true }) as unknown as typeof fetch).getSubscription("sub_1")).rejects.toThrow(/livemode/);
    const err = await new StripeTestProvider(SK, fakeFetch({ error: { code: "resource_missing", message: "dados do cliente fulano" } }, 404) as unknown as typeof fetch).getInvoice("in_x").catch((e) => e);
    expect(err).toBeInstanceOf(StripeApiError);
    expect(String(err.message)).not.toContain("fulano");
  });
  it("preço existente com valor diferente do aprovado é recusado", async () => {
    const f = fakeFetch({ data: [{ id: "price_old", product: "prod_1", unit_amount: 999 }] });
    await expect(new StripeTestProvider(SK, f as unknown as typeof fetch).ensurePrice({ lookupKey: "wjb_nfse_mei_v2_d0", productName: "MEI", amountCents: 2490, recurring: true })).rejects.toThrow(/difere/);
  });
  it("codificação de formulário aninhado", () => {
    expect(encodeForm({ a: { b: [{ c: 1 }] }, d: "x y", e: undefined })).toEqual(["a%5Bb%5D%5B0%5D%5Bc%5D=1", "d=x%20y"]);
  });
});

describe("tradução de estados e regras", () => {
  it("status da assinatura", () => {
    expect(mapSubscriptionStatus("active")).toBe("ativa_teste");
    expect(mapSubscriptionStatus("past_due")).toBe("inadimplente");
    expect(mapSubscriptionStatus("canceled")).toBe("cancelada");
    expect(mapSubscriptionStatus("incomplete")).toBe("pendente_pagamento");
    expect(mapSubscriptionStatus("algo_novo")).toBe("pendente_pagamento"); // desconhecido nunca dá acesso
    expect(mapInvoiceStatus("paid")).toBe("paga");
  });
  it("cancelada é final: evento antigo fora de ordem não reativa", () => {
    expect(nextStatus("cancelada", "ativa_teste")).toBe("cancelada");
    expect(nextStatus("inadimplente", "ativa_teste")).toBe("ativa_teste");
  });
  it("só sessão completa e paga (ou sem pagamento devido) conta", () => {
    const base = { id: "cs", customerId: null, subscriptionId: null, clientReferenceId: null, url: null };
    expect(sessionIsPaid({ ...base, status: "complete", paymentStatus: "paid" })).toBe(true);
    expect(sessionIsPaid({ ...base, status: "complete", paymentStatus: "no_payment_required" })).toBe(true);
    expect(sessionIsPaid({ ...base, status: "complete", paymentStatus: "unpaid" })).toBe(false); // boleto/pix assíncrono
    expect(sessionIsPaid({ ...base, status: "open", paymentStatus: "paid" })).toBe(false);
  });
  it("pagamento confirmado em teste libera consumo; pendente e inadimplente não", () => {
    const sub = { sku: "nfse_mei", monthlyCents: 2490, quota: 10, overageCents: 390, discountBp: 0, overageAuthorized: false, spendingLimitCents: null };
    expect(canConsume({ ...sub, status: "ativa_teste" }, 0).allowed).toBe(true);
    expect(canConsume({ ...sub, status: "pendente_pagamento" }, 0).allowed).toBe(false);
    expect(canConsume({ ...sub, status: "inadimplente" }, 0).allowed).toBe(false);
  });
  it("cobrança por nota só de evento oficial, sem cobrar duas vezes", () => {
    const avulsa = { quota: 0, overageCents: 490, monthlyCents: 0, overageAuthorized: false };
    expect(planUsageCharges({ ...avulsa, officialBillableInCycle: 3, alreadyChargedInCycle: 1 })).toEqual({ notes: 2, amountCents: 980 });
    const mei = { quota: 10, overageCents: 390, monthlyCents: 2490 };
    expect(planUsageCharges({ ...mei, overageAuthorized: false, officialBillableInCycle: 12, alreadyChargedInCycle: 0 }).notes).toBe(0);
    expect(planUsageCharges({ ...mei, overageAuthorized: true, officialBillableInCycle: 12, alreadyChargedInCycle: 0 })).toEqual({ notes: 2, amountCents: 780 });
    expect(planUsageCharges({ quota: null, overageCents: null, monthlyCents: null, overageAuthorized: true, officialBillableInCycle: 999, alreadyChargedInCycle: 0 }).notes).toBe(0);
  });
  it("chave do preço muda com a versão aprovada e com o desconto", () => {
    expect(priceLookupKey("nfse_mei", 2, 2000)).toBe("wjb_nfse_mei_v2_d2000");
  });
});

import { getPublicWhatsAppPhones } from "@/integrations/whatsapp";
describe("inventário do WhatsApp (Fase 9.1)", () => {
  it("só o número oficial é exibido como WhatsApp", () => {
    expect(getPublicWhatsAppPhones().map((p) => p.e164)).toEqual(["5511976146375"]);
  });
});
