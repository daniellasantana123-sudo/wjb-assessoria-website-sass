import { describe, expect, it, vi } from "vitest";

import { checkoutMethodOptionsFromEnv } from "@/lib/payments/config";
import { sessionIsPaid } from "@/lib/payments/mapping";
import { checkoutMethodOptionsBody, StripeTestProvider } from "@/lib/payments/stripe-provider";

/** Fase 10E: métodos brasileiros e pagamento avulso, sem rede (fetch falso). */
const SK = "sk_test_" + "a".repeat(24);
const base = { customerId: "cus_1", successUrl: "https://h/s", cancelUrl: "https://h/c", clientReferenceId: "ck1", metadata: { wjb_tenant: "t1" }, idempotencyKey: "checkout:ck1" };
function provider() {
  const f = vi.fn(async (...args: [string, RequestInit?]) => (void args, new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/x" }), { status: 200 })));
  return { p: new StripeTestProvider(SK, f as unknown as typeof fetch), body: () => decodeURIComponent(String(f.mock.calls[0][1]!.body)), calls: f.mock.calls };
}

describe("Pix Automático e boleto no Checkout (desligados por padrão)", () => {
  it("sem configuração nada é enviado: o Checkout segue o Dashboard", async () => {
    const { p, body } = provider();
    await p.createCheckoutSession({ ...base, kind: "subscription", priceId: "price_1" });
    expect(body()).not.toContain("payment_method_options");
    expect(checkoutMethodOptionsFromEnv(() => "")).toEqual({ options: {}, problems: [] });
  });
  it("assinatura: mandato do Pix Automático com valor MÁXIMO mensal e vencimento do boleto", async () => {
    const { p, body } = provider();
    await p.createCheckoutSession({ ...base, kind: "subscription", priceId: "price_1", methodOptions: { pixAutomaticMaxCents: 50000, boletoExpiresAfterDays: 5 } });
    expect(body()).toContain("payment_method_options[pix][mandate_options][amount]=50000");
    expect(body()).toContain("payment_method_options[pix][mandate_options][amount_type]=maximum");
    expect(body()).toContain("payment_method_options[pix][mandate_options][payment_schedule]=monthly");
    expect(body()).toContain("payment_method_options[boleto][expires_after_days]=5");
  });
  it("valores fora da faixa são recusados antes de qualquer chamada", async () => {
    const { p, calls } = provider();
    await expect(p.createCheckoutSession({ ...base, kind: "subscription", priceId: "price_1", methodOptions: { boletoExpiresAfterDays: 61 } })).rejects.toThrow(/0 a 60/);
    await expect(p.createCheckoutSession({ ...base, kind: "subscription", priceId: "price_1", methodOptions: { pixAutomaticMaxCents: 10 } })).rejects.toThrow(/Pix/);
    expect(calls).toHaveLength(0);
    const env = (m: Record<string, string>) => (k: string) => m[k] ?? "";
    expect(checkoutMethodOptionsFromEnv(env({ WJB_PAYMENTS_BOLETO_EXPIRES_DAYS: "abc", WJB_PAYMENTS_PIX_AUTOMATICO_MAX_CENTS: "-1" })).problems).toHaveLength(2);
    expect(checkoutMethodOptionsFromEnv(env({ WJB_PAYMENTS_BOLETO_EXPIRES_DAYS: "3", WJB_PAYMENTS_PIX_AUTOMATICO_MAX_CENTS: "49900" }))).toEqual({ options: { boletoExpiresAfterDays: 3, pixAutomaticMaxCents: 49900 }, problems: [] });
  });
  it("Pix Automático não se aplica a pagamento único nem ao cadastro de cartão", () => {
    expect(checkoutMethodOptionsBody("payment", { pixAutomaticMaxCents: 50000 })).toEqual({});
    expect(checkoutMethodOptionsBody("setup", { pixAutomaticMaxCents: 50000, boletoExpiresAfterDays: 3 })).toEqual({});
    expect(checkoutMethodOptionsBody("payment", { boletoExpiresAfterDays: 3 })).toEqual({ payment_method_options: { boleto: { expires_after_days: 3 } } });
  });
});

describe("pagamento avulso (serviço adicional)", () => {
  it("modo payment com o preço do catálogo e os metadados no PaymentIntent", async () => {
    const { p, body } = provider();
    await p.createCheckoutSession({ ...base, kind: "payment", priceId: "price_servico" });
    expect(body()).toContain("mode=payment");
    expect(body()).toContain("line_items[0][price]=price_servico");
    expect(body()).toContain("payment_intent_data[metadata][wjb_tenant]=t1");
    expect(body()).not.toContain("subscription_data");
  });
  it("sem preço do catálogo não há Checkout (nenhum valor é inventado)", async () => {
    const { p, calls } = provider();
    await expect(p.createCheckoutSession({ ...base, kind: "payment", priceId: null })).rejects.toThrow(/preço do catálogo/);
    expect(calls).toHaveLength(0);
  });
  it("pagamento pendente (boleto/Pix) não libera nada até a confirmação", () => {
    expect(sessionIsPaid({ id: "cs", status: "complete", paymentStatus: "unpaid" } as never)).toBe(false);
    expect(sessionIsPaid({ id: "cs", status: "complete", paymentStatus: "paid" } as never)).toBe(true);
  });
});
