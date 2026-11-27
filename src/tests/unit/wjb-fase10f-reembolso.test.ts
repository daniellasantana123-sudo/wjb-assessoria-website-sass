import { describe, expect, it } from "vitest";

import { evaluateRefund, parseBrlToCents, refundIdempotencyKey, remainingRefundableCents } from "@/lib/payments/refunds";
import { StripeTestProvider } from "@/lib/payments/stripe-provider";
import type { PCharge } from "@/lib/payments/types";

// Valores FICTÍCIOS de teste (não são preços da WJB).
const charge = (over: Partial<PCharge> = {}): PCharge => ({
  id: "ch_teste_1",
  invoiceId: "in_teste_1",
  customerId: "cus_teste_1",
  amountCents: 10_000,
  amountRefundedCents: 0,
  disputed: false,
  status: "succeeded",
  paymentMethodType: "card",
  ...over,
});

describe("Fase 10F: regra de reembolso", () => {
  it("cartão e Pix pagos: total e parcial", () => {
    expect(evaluateRefund(charge(), 10_000, "pedido_do_cliente")).toMatchObject({ ok: true, amountCents: 10_000, stripeReason: "requested_by_customer" });
    expect(evaluateRefund(charge({ paymentMethodType: "pix" }), 2_500, "cobranca_duplicada")).toMatchObject({ ok: true, stripeReason: "duplicate" });
  });

  it("bloqueia boleto, contestação, não paga, método desconhecido e valor fora do saldo", () => {
    const code = (c: PCharge, v: number) => {
      const d = evaluateRefund(c, v, "pedido_do_cliente");
      return d.ok ? "ok" : d.code;
    };
    expect(code(charge({ paymentMethodType: "boleto" }), 100)).toBe("BOLETO_SEM_REEMBOLSO");
    expect(code(charge({ disputed: true }), 100)).toBe("CONTESTADA");
    expect(code(charge({ status: "pending" }), 100)).toBe("NAO_PAGA");
    expect(code(charge({ paymentMethodType: null }), 100)).toBe("METODO_DESCONHECIDO");
    expect(code(charge({ paymentMethodType: "outro" }), 100)).toBe("METODO_DESCONHECIDO");
    expect(code(charge(), 0)).toBe("VALOR_INVALIDO");
    expect(code(charge(), 10.5)).toBe("VALOR_INVALIDO");
    expect(code(charge({ amountRefundedCents: 9_000 }), 1_001)).toBe("VALOR_ACIMA_DO_SALDO");
    expect(remainingRefundableCents(charge({ amountRefundedCents: 9_000 }))).toBe(1_000);
  });

  it("idempotência: mesmo estado = mesma chave; depois de um reembolso, outra chave", () => {
    const a = refundIdempotencyKey("ch_1", 0, 500);
    expect(refundIdempotencyKey("ch_1", 0, 500)).toBe(a);
    expect(refundIdempotencyKey("ch_1", 500, 500)).not.toBe(a);
    expect(a).toMatch(/^wjb-refund-[0-9a-f]{40}$/);
  });

  it("converte reais para centavos", () => {
    expect(parseBrlToCents("49,90")).toBe(4_990);
    expect(parseBrlToCents("R$ 100")).toBe(10_000);
    expect(parseBrlToCents("1.5")).toBe(150);
    expect(parseBrlToCents("1.000,00")).toBeNaN();
    expect(parseBrlToCents("-5")).toBeNaN();
  });
});

describe("Fase 10F: reembolso pela API da Stripe (fetch falso, sem rede)", () => {
  it("POST /v1/refunds com chave de idempotência, cobrança e valor; lê método e saldo da cobrança", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.includes("/refunds")
        ? { id: "re_teste", status: "succeeded", amount: 2_500, livemode: false }
        : { id: "ch_teste", amount: 10_000, amount_refunded: 0, status: "succeeded", payment_method_details: { type: "pix" }, invoice: "in_t", customer: "cus_t", livemode: false };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new StripeTestProvider(`sk_test_${"x".repeat(24)}`, fakeFetch);
    const ch = await p.getCharge("ch_teste");
    expect(ch).toMatchObject({ amountCents: 10_000, paymentMethodType: "pix", status: "succeeded" });
    const r = await p.createRefund({ chargeId: "ch_teste", amountCents: 2_500, reason: "requested_by_customer", idempotencyKey: "wjb-refund-abc", metadata: { wjb_tenant: "t1" } });
    expect(r).toEqual({ id: "re_teste", status: "succeeded", amountCents: 2_500 });
    const post = calls.find((c) => c.url.endsWith("/v1/refunds"))!;
    expect(post.init.method).toBe("POST");
    expect((post.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("wjb-refund-abc");
    expect(String(post.init.body)).toContain("charge=ch_teste");
    expect(String(post.init.body)).toContain("amount=2500");
    expect(String(post.init.body)).toContain("reason=requested_by_customer");
  });

  it("recusa objeto de produção (livemode) na resposta", async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ id: "re_x", livemode: true }), { status: 200 })) as unknown as typeof fetch;
    const p = new StripeTestProvider(`sk_test_${"x".repeat(24)}`, fakeFetch);
    await expect(p.createRefund({ chargeId: "c", amountCents: 1, reason: "duplicate", idempotencyKey: "k", metadata: {} })).rejects.toThrow(/livemode/);
  });
});
