import "server-only";

import { checkStripeKeys, STRIPE_API_VERSION, stripeKeysFromEnv } from "./config";
import { HANDLED_EVENTS, type CheckoutMethodOptions, type PaymentProvider, type PCharge, type PCheckoutSession, type PInvoice, type PRefund, type PSubscription } from "./types";

/**
 * Provedor Stripe em MODO DE TESTE (Fase 9.1), pela API REST oficial
 * (`https://api.stripe.com/v1`, corpo `application/x-www-form-urlencoded`),
 * sem SDK novo. Versão da API fixada (STRIPE_API_VERSION). Recusa qualquer
 * chave que não seja de teste ANTES de qualquer chamada.
 *
 * Checkout sem `payment_method_types`: os meios exibidos vêm da configuração
 * do Dashboard (cartão, Apple Pay/Google Pay, boleto e Pix Automático, cada um
 * ligado lá; ver docs/wjb-ai/fase-10d/04). Pix e boleto confirmam DEPOIS do
 * Checkout (eventos async_payment_*). Link (Fase 10C, 26/11/2026): a tabela
 * oficial de países da Stripe não lista o Brasil como local de empresa do
 * Link e o Payment Element não aceita Link no Brasil; por isso nada aqui
 * pede Link explicitamente (docs/wjb-ai/fase-10c/08).
 */
/**
 * Fase 10E: `payment_method_options` só com o que foi configurado. Pix
 * Automático só existe em assinatura (mandato com valor MÁXIMO mensal);
 * boleto vale para assinatura e pagamento único. Valores fora da faixa são
 * recusados aqui, antes de qualquer chamada.
 */
export function checkoutMethodOptionsBody(
  kind: "subscription" | "setup" | "payment",
  o: CheckoutMethodOptions | undefined,
): { payment_method_options?: Record<string, unknown> } {
  if (!o || kind === "setup") return {};
  const pmo: Record<string, unknown> = {};
  if (o.pixAutomaticMaxCents !== undefined && kind === "subscription") {
    if (!Number.isInteger(o.pixAutomaticMaxCents) || o.pixAutomaticMaxCents < 50)
      throw new Error("Limite do Pix Automático inválido.");
    pmo.pix = { mandate_options: { amount: o.pixAutomaticMaxCents, amount_type: "maximum", payment_schedule: "monthly" } };
  }
  if (o.boletoExpiresAfterDays !== undefined) {
    if (!Number.isInteger(o.boletoExpiresAfterDays) || o.boletoExpiresAfterDays < 0 || o.boletoExpiresAfterDays > 60)
      throw new Error("Vencimento do boleto inválido (0 a 60 dias).");
    pmo.boleto = { expires_after_days: o.boletoExpiresAfterDays };
  }
  return Object.keys(pmo).length ? { payment_method_options: pmo } : {};
}

export class StripeApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Stripe respondeu ${status}${code ? ` (${code})` : ""}`);
    this.name = "StripeApiError";
  }
}

/** Codifica objeto aninhado no formato da Stripe: a[b][0][c]=v. */
export function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item !== null ? out.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`)) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") out.push(...encodeForm(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

type Fetch = typeof fetch;

export class StripeTestProvider implements PaymentProvider {
  readonly mode = "test" as const;
  private readonly secret: string;

  constructor(
    secret = stripeKeysFromEnv().secret,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    // Aqui só a chave secreta importa (o segredo do webhook é conferido na rota).
    const problems = checkStripeKeys({ secret, publishable: "", webhook: "whsec_0000000000000000" }).problems;
    if (problems.length) throw new Error(`Stripe desligada: ${problems.join("; ")}`);
    this.secret = secret;
  }

  private async call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const query = method === "GET" && body ? `?${encodeForm(body).join("&")}` : "";
    const res = await this.fetchImpl(`https://api.stripe.com/v1${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secret}`,
        "Stripe-Version": STRIPE_API_VERSION,
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: method === "POST" && body ? encodeForm(body).join("&") : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    // Nunca devolve corpo bruto de erro (pode conter dado do cliente).
    if (!res.ok) throw new StripeApiError(res.status, ((json.error as { code?: string } | undefined)?.code as string) ?? null);
    if (json.livemode === true) throw new Error("Objeto de produção (livemode) recusado neste ambiente.");
    return json as T;
  }

  async ensureCustomer({ tenantId, idempotencyKey }: { tenantId: string; idempotencyKey: string }) {
    // Só o id interno opaco da empresa; nenhum nome, e-mail ou documento.
    const c = await this.call<{ id: string }>("POST", "/customers", { metadata: { wjb_tenant: tenantId } }, idempotencyKey);
    return c.id;
  }

  async ensurePrice({ lookupKey, productName, amountCents, recurring }: { lookupKey: string; productName: string; amountCents: number; recurring: boolean }) {
    const found = await this.call<{ data: { id: string; product: string; unit_amount: number }[] }>("GET", "/prices", { lookup_keys: [lookupKey], active: "true" });
    const hit = found.data[0];
    if (hit) {
      if (hit.unit_amount !== amountCents) throw new Error(`Preço ${lookupKey} na Stripe difere do catálogo aprovado.`);
      return { priceId: hit.id, productId: hit.product };
    }
    const p = await this.call<{ id: string; product: string }>(
      "POST",
      "/prices",
      {
        currency: "brl",
        unit_amount: amountCents,
        lookup_key: lookupKey,
        product_data: { name: productName, metadata: { wjb_lookup: lookupKey } },
        ...(recurring ? { recurring: { interval: "month" } } : {}),
      },
      `price:${lookupKey}`,
    );
    return { priceId: p.id, productId: p.product };
  }

  async createCheckoutSession(i: Parameters<PaymentProvider["createCheckoutSession"]>[0]) {
    const common = {
      customer: i.customerId,
      client_reference_id: i.clientReferenceId,
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      locale: "pt-BR",
      metadata: i.metadata,
    };
    if (i.kind !== "setup" && !i.priceId) throw new Error("Checkout de assinatura ou pagamento exige um preço do catálogo.");
    const methodOptions = checkoutMethodOptionsBody(i.kind, i.methodOptions);
    const body =
      i.kind === "subscription"
        ? { ...common, mode: "subscription", line_items: [{ price: i.priceId, quantity: 1 }], subscription_data: { metadata: i.metadata }, ...methodOptions }
        : i.kind === "payment"
          ? { ...common, mode: "payment", line_items: [{ price: i.priceId, quantity: 1 }], payment_intent_data: { metadata: i.metadata }, ...methodOptions }
          : { ...common, mode: "setup", currency: "brl", setup_intent_data: { metadata: i.metadata } };
    const s = await this.call<{ id: string; url: string }>("POST", "/checkout/sessions", body, i.idempotencyKey);
    return { id: s.id, url: s.url };
  }

  async expireCheckoutSession(id: string) {
    await this.call("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`);
  }

  async createPortalSession({ customerId, returnUrl }: { customerId: string; returnUrl: string }) {
    const s = await this.call<{ url: string }>("POST", "/billing_portal/sessions", { customer: customerId, return_url: returnUrl, locale: "pt-BR" });
    return { url: s.url };
  }

  async cancelSubscription({ subscriptionId, atPeriodEnd, idempotencyKey }: { subscriptionId: string; atPeriodEnd: boolean; idempotencyKey: string }) {
    if (atPeriodEnd) await this.call("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "true" }, idempotencyKey);
    else await this.call("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  async getCheckoutSession(id: string): Promise<PCheckoutSession> {
    const s = await this.call<Record<string, unknown>>("GET", `/checkout/sessions/${encodeURIComponent(id)}`);
    return {
      id: String(s.id),
      status: s.status as PCheckoutSession["status"],
      paymentStatus: s.payment_status as PCheckoutSession["paymentStatus"],
      customerId: (s.customer as string) ?? null,
      subscriptionId: (s.subscription as string) ?? null,
      clientReferenceId: (s.client_reference_id as string) ?? null,
      url: (s.url as string) ?? null,
    };
  }

  async getSubscription(id: string): Promise<PSubscription> {
    const s = await this.call<Record<string, unknown>>("GET", `/subscriptions/${encodeURIComponent(id)}`);
    return {
      id: String(s.id),
      status: String(s.status),
      customerId: (s.customer as string) ?? null,
      currentPeriodEnd: (s.current_period_end as number) ?? null,
      cancelAtPeriodEnd: s.cancel_at_period_end === true,
      priceId: ((s.items as { data?: { price?: { id?: string } }[] } | undefined)?.data?.[0]?.price?.id as string) ?? null,
      itemId: ((s.items as { data?: { id?: string }[] } | undefined)?.data?.[0]?.id as string) ?? null,
    };
  }

  async changeSubscriptionPrice({ subscriptionId, newPriceId, idempotencyKey }: { subscriptionId: string; newPriceId: string; idempotencyKey: string }) {
    const cur = await this.getSubscription(subscriptionId);
    if (!cur.itemId) throw new Error("assinatura sem item");
    const s = await this.call<{ latest_invoice?: string | null }>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { items: [{ id: cur.itemId, price: newPriceId }], proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" },
      idempotencyKey,
    );
    return { invoiceId: typeof s.latest_invoice === "string" ? s.latest_invoice : null };
  }

  async previewPriceChange({ customerId, subscriptionId, newPriceId }: { customerId: string; subscriptionId: string; newPriceId: string }) {
    const cur = await this.getSubscription(subscriptionId);
    if (!cur.itemId) throw new Error("assinatura sem item");
    const inv = await this.call<{ amount_due: number }>("GET", "/invoices/upcoming", {
      customer: customerId,
      subscription: subscriptionId,
      subscription_items: [{ id: cur.itemId, price: newPriceId }],
      subscription_proration_behavior: "always_invoice",
    });
    return { amountDueCents: Number(inv.amount_due ?? 0) };
  }

  async listEvents({ createdGte }: { createdGte: number }) {
    const out: import("./types").PEvent[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; page < 3; page++) {
      const r = await this.call<{ data: { id: string; type: string; livemode: boolean; data: { object: { id?: string; charge?: string } } }[]; has_more: boolean }>("GET", "/events", {
        created: { gte: createdGte },
        types: [...HANDLED_EVENTS],
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const e of r.data)
        out.push({ id: e.id, type: e.type, livemode: e.livemode, objectId: e.data?.object?.id ?? null, relatedChargeId: e.type.startsWith("charge.dispute.") ? (e.data?.object?.charge ?? null) : null });
      if (!r.has_more || r.data.length === 0) break;
      startingAfter = r.data[r.data.length - 1].id;
    }
    return out.reverse(); // mais antigos primeiro
  }

  async getInvoice(id: string): Promise<PInvoice> {
    const s = await this.call<Record<string, unknown>>("GET", `/invoices/${encodeURIComponent(id)}`);
    return {
      id: String(s.id),
      status: s.status as PInvoice["status"],
      customerId: (s.customer as string) ?? null,
      subscriptionId: (s.subscription as string) ?? null,
      amountDueCents: Number(s.amount_due ?? 0),
      amountPaidCents: Number(s.amount_paid ?? 0),
      currency: String(s.currency ?? ""),
      periodStart: (s.period_start as number) ?? null,
      periodEnd: (s.period_end as number) ?? null,
      hostedInvoiceUrl: (s.hosted_invoice_url as string) ?? null,
      chargeId: typeof s.charge === "string" ? s.charge : ((s.charge as { id?: string } | null)?.id ?? null),
    };
  }

  async getCharge(id: string): Promise<PCharge> {
    const s = await this.call<Record<string, unknown>>("GET", `/charges/${encodeURIComponent(id)}`);
    return {
      id: String(s.id),
      invoiceId: (s.invoice as string) ?? null,
      customerId: (s.customer as string) ?? null,
      amountCents: Number(s.amount ?? 0),
      amountRefundedCents: Number(s.amount_refunded ?? 0),
      disputed: s.disputed === true,
      status: String(s.status ?? ""),
      paymentMethodType: ((s.payment_method_details as { type?: string } | null)?.type as string) ?? null,
    };
  }

  async createRefund({ chargeId, amountCents, reason, idempotencyKey, metadata }: Parameters<PaymentProvider["createRefund"]>[0]): Promise<PRefund> {
    const r = await this.call<Record<string, unknown>>("POST", "/refunds", { charge: chargeId, amount: amountCents, reason, metadata }, idempotencyKey);
    return { id: String(r.id), status: String(r.status ?? ""), amountCents: Number(r.amount ?? 0) };
  }
}
