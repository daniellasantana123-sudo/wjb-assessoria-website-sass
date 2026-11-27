import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/db/supabase/admin";

import { createHash } from "node:crypto";

import type { PaymentProvider, PCharge, PCheckoutSession, PEvent, PInvoice, PRefund, PSubscription } from "./types";

/**
 * Provedor SIMULADO (Fase 9.1): imita a Stripe sem rede nem dinheiro, para
 * homologar o fluxo inteiro enquanto não há conta de teste. Guarda os
 * objetos em `payment_mock_objects` (só o servidor acessa). Os "eventos"
 * gerados passam pelo MESMO tratador dos webhooks reais, que busca de novo o
 * objeto aqui antes de dar acesso, como faria com a Stripe.
 */
type Obj = Record<string, unknown>;
const now = () => Math.floor(Date.now() / 1000);
const MONTH = 30 * 24 * 3600;

async function save(id: string, type: string, data: Obj) {
  const { error } = await createAdminClient().from("payment_mock_objects").upsert({ id, type, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`mock: ${error.message}`);
}
async function load(id: string): Promise<Obj> {
  const { data } = await createAdminClient().from("payment_mock_objects").select("data").eq("id", id).maybeSingle();
  if (!data) throw new Error("mock: objeto não encontrado");
  return data.data as Obj;
}
const evt = (type: string, objectId: string, extra: Partial<PEvent> = {}): PEvent => ({ id: `evt_mock_${randomUUID()}`, type, livemode: false, objectId, ...extra });

export class MockPaymentProvider implements PaymentProvider {
  readonly mode = "mock" as const;

  async ensureCustomer({ tenantId }: { tenantId: string; idempotencyKey: string }) {
    const id = `cus_mock_${randomUUID().slice(0, 12)}`;
    await save(id, "customer", { id, metadata: { wjb_tenant: tenantId } });
    return id;
  }

  async ensurePrice({ lookupKey, amountCents, recurring }: { lookupKey: string; productName: string; amountCents: number; recurring: boolean }) {
    const id = `price_mock_${lookupKey}`;
    try {
      const p = await load(id);
      if (p.unit_amount !== amountCents) throw new Error(`Preço ${lookupKey} difere do catálogo aprovado.`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("difere")) throw e;
      await save(id, "price", { id, unit_amount: amountCents, currency: "brl", recurring, product: `prod_mock_${lookupKey}` });
    }
    return { priceId: id, productId: `prod_mock_${lookupKey}` };
  }

  async createCheckoutSession(i: Parameters<PaymentProvider["createCheckoutSession"]>[0]) {
    const id = `cs_mock_${randomUUID()}`;
    const url = `/portal/plano/checkout-simulado/${id}`;
    await save(id, "checkout_session", { id, status: "open", payment_status: "unpaid", customer: i.customerId, subscription: null, client_reference_id: i.clientReferenceId, kind: i.kind, price: i.priceId, url, metadata: i.metadata });
    return { id, url };
  }

  async expireCheckoutSession(id: string) {
    const s = await load(id);
    if (s.status === "open") await save(id, "checkout_session", { ...s, status: "expired" });
  }

  async createPortalSession() {
    return { url: "/portal/plano?portal=simulado" };
  }

  async cancelSubscription({ subscriptionId, atPeriodEnd }: { subscriptionId: string; atPeriodEnd: boolean; idempotencyKey: string }) {
    const s = await load(subscriptionId);
    await save(subscriptionId, "subscription", atPeriodEnd ? { ...s, cancel_at_period_end: true } : { ...s, status: "canceled" });
  }

  async getCheckoutSession(id: string): Promise<PCheckoutSession> {
    const s = await load(id);
    return { id, status: s.status as PCheckoutSession["status"], paymentStatus: s.payment_status as PCheckoutSession["paymentStatus"], customerId: (s.customer as string) ?? null, subscriptionId: (s.subscription as string) ?? null, clientReferenceId: (s.client_reference_id as string) ?? null, url: (s.url as string) ?? null };
  }
  async getSubscription(id: string): Promise<PSubscription> {
    const s = await load(id);
    return { id, status: String(s.status), customerId: (s.customer as string) ?? null, currentPeriodEnd: (s.current_period_end as number) ?? null, cancelAtPeriodEnd: s.cancel_at_period_end === true, priceId: (s.price as string) ?? null, itemId: `si_${id}` };
  }
  /** Proporcional simples pelo tempo restante do período (a Stripe calcula por segundo). */
  private async prorate(subscriptionId: string, newPriceId: string) {
    const sub = await load(subscriptionId);
    const [oldP, newP] = await Promise.all([load(String(sub.price)), load(newPriceId)]);
    const left = Math.max(0, Math.min(1, (Number(sub.current_period_end) - now()) / MONTH));
    return { sub, amount: Math.round((Number(newP.unit_amount) - Number(oldP.unit_amount)) * left) };
  }
  async previewPriceChange({ subscriptionId, newPriceId }: { customerId: string; subscriptionId: string; newPriceId: string }) {
    const { amount } = await this.prorate(subscriptionId, newPriceId);
    return { amountDueCents: Math.max(0, amount) };
  }
  async changeSubscriptionPrice({ subscriptionId, newPriceId }: { subscriptionId: string; newPriceId: string; idempotencyKey: string }) {
    const { sub, amount } = await this.prorate(subscriptionId, newPriceId);
    await save(subscriptionId, "subscription", { ...sub, price: newPriceId });
    if (amount <= 0) return { invoiceId: null }; // crédito fica para a próxima fatura
    const invId = `in_mock_${randomUUID().slice(0, 12)}`;
    await save(invId, "invoice", { id: invId, status: "paid", customer: sub.customer, subscription: subscriptionId, amount_due: amount, amount_paid: amount, period_start: now(), period_end: sub.current_period_end });
    return { invoiceId: invId };
  }
  async listEvents() {
    return []; // eventos simulados são tratados na hora
  }
  async getInvoice(id: string): Promise<PInvoice> {
    const s = await load(id);
    return { id, status: s.status as PInvoice["status"], customerId: (s.customer as string) ?? null, subscriptionId: (s.subscription as string) ?? null, amountDueCents: Number(s.amount_due), amountPaidCents: Number(s.amount_paid), currency: "brl", periodStart: (s.period_start as number) ?? null, periodEnd: (s.period_end as number) ?? null, hostedInvoiceUrl: null, chargeId: (s.charge as string) ?? null };
  }
  async getCharge(id: string): Promise<PCharge> {
    const s = await load(id);
    return {
      id,
      invoiceId: (s.invoice as string) ?? null,
      customerId: (s.customer as string) ?? null,
      amountCents: Number(s.amount ?? s.amount_refunded ?? 0),
      amountRefundedCents: Number(s.amount_refunded ?? 0),
      disputed: s.disputed === true,
      status: String(s.status ?? "succeeded"),
      paymentMethodType: (s.payment_method_type as string) ?? "card",
    };
  }

  /** Mesma chave = mesmo reembolso, como na Stripe. */
  async createRefund({ chargeId, amountCents, idempotencyKey }: Parameters<PaymentProvider["createRefund"]>[0]): Promise<PRefund> {
    const id = `re_mock_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16)}`;
    try {
      const existing = await load(id);
      return { id, status: String(existing.status), amountCents: Number(existing.amount) };
    } catch {
      // primeiro pedido com esta chave
    }
    const ch = await load(chargeId);
    const refunded = Number(ch.amount_refunded ?? 0) + amountCents;
    if (refunded > Number(ch.amount ?? 0)) throw new Error("mock: reembolso acima do valor cobrado");
    await save(chargeId, "charge", { ...ch, amount_refunded: refunded });
    await save(id, "refund", { id, charge: chargeId, amount: amountCents, status: "succeeded" });
    return { id, status: "succeeded", amountCents };
  }
}

// ---------- Ações de teste (só no provedor simulado) ----------

/** Pagamento no checkout simulado. Recusado: nada muda, como na Stripe (o cliente tenta de novo). */
export async function mockPayCheckout(sessionId: string, outcome: "aprovado" | "recusado"): Promise<PEvent[]> {
  const s = await load(sessionId);
  if (s.status !== "open") return [];
  if (outcome === "recusado") return [];
  if (s.kind === "setup") {
    await save(sessionId, "checkout_session", { ...s, status: "complete", payment_status: "no_payment_required" });
    return [evt("checkout.session.completed", sessionId)];
  }
  const price = await load(String(s.price));
  const subId = `sub_mock_${randomUUID().slice(0, 12)}`;
  const invId = `in_mock_${randomUUID().slice(0, 12)}`;
  const t = now();
  await save(subId, "subscription", { id: subId, status: "active", customer: s.customer, current_period_end: t + MONTH, cancel_at_period_end: false, price: s.price });
  const chId = `ch_mock_${randomUUID().slice(0, 12)}`;
  await save(chId, "charge", { id: chId, invoice: invId, customer: s.customer, amount: price.unit_amount, amount_refunded: 0, disputed: false, status: "succeeded", payment_method_type: "card" });
  await save(invId, "invoice", { id: invId, status: "paid", customer: s.customer, subscription: subId, amount_due: price.unit_amount, amount_paid: price.unit_amount, period_start: t, period_end: t + MONTH, charge: chId });
  await save(sessionId, "checkout_session", { ...s, status: "complete", payment_status: "paid", subscription: subId });
  // Ordem diferente da natural de propósito: o tratador não depende da ordem.
  return [evt("invoice.paid", invId), evt("checkout.session.completed", sessionId), evt("customer.subscription.updated", subId)];
}

/** Renovação: paga ou com falha (cartão recusado na cobrança do mês seguinte). */
export async function mockRenewal(subscriptionId: string, outcome: "paga" | "falhou"): Promise<PEvent[]> {
  const sub = await load(subscriptionId);
  const price = await load(String(sub.price));
  const invId = `in_mock_${randomUUID().slice(0, 12)}`;
  const t = now();
  const paid = outcome === "paga";
  const chId = paid ? `ch_mock_${randomUUID().slice(0, 12)}` : null;
  if (chId) await save(chId, "charge", { id: chId, invoice: invId, customer: sub.customer, amount: price.unit_amount, amount_refunded: 0, disputed: false, status: "succeeded", payment_method_type: "card" });
  await save(invId, "invoice", { id: invId, status: paid ? "paid" : "open", customer: sub.customer, subscription: subscriptionId, amount_due: price.unit_amount, amount_paid: paid ? price.unit_amount : 0, period_start: t, period_end: t + MONTH, charge: chId });
  await save(subscriptionId, "subscription", { ...sub, status: paid ? "active" : "past_due", current_period_end: paid ? t + MONTH : sub.current_period_end });
  return [evt(paid ? "invoice.paid" : "invoice.payment_failed", invId), evt("customer.subscription.updated", subscriptionId)];
}

export async function mockRefundOrDispute(invoiceId: string, kind: "estorno" | "contestacao"): Promise<PEvent[]> {
  const inv = await load(invoiceId);
  // Fase 10F: usa a cobrança da fatura quando existe (faturas antigas do simulado não tinham).
  const chId = (inv.charge as string) ?? `ch_mock_${randomUUID().slice(0, 12)}`;
  let prev: Obj = {};
  try {
    prev = await load(chId);
  } catch {
    // fatura antiga, sem cobrança registrada
  }
  await save(chId, "charge", { status: "succeeded", payment_method_type: "card", amount: inv.amount_paid, ...prev, id: chId, invoice: invoiceId, customer: inv.customer, amount_refunded: kind === "estorno" ? inv.amount_paid : Number(prev.amount_refunded ?? 0), disputed: kind === "contestacao" });
  return kind === "estorno" ? [evt("charge.refunded", chId)] : [evt("charge.dispute.created", `dp_mock_${chId}`, { relatedChargeId: chId })];
}

export async function mockCancelNow(subscriptionId: string): Promise<PEvent[]> {
  const sub = await load(subscriptionId);
  await save(subscriptionId, "subscription", { ...sub, status: "canceled" });
  return [evt("customer.subscription.deleted", subscriptionId)];
}
