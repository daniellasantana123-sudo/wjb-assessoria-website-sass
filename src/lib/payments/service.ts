import "server-only";

import { createHash } from "node:crypto";

import { ACCEPTANCE_DOCUMENTS, comboDiscountBp, cycleFor, isPerNotePlan, monthlyWithDiscount, type AcceptanceDocument } from "@/lib/commercial/pricing";
import { getComboDiscountBp } from "@/lib/commercial/repo";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { toIsoDate } from "@/lib/reports/period";

import { checkoutMethodOptionsFromEnv, getPaymentsStatus } from "./config";
import { mapInvoiceStatus, mapSubscriptionStatus, nextStatus, priceLookupKey, sessionIsPaid } from "./mapping";
import { blockedMessage, canChargeWithStripe, type BillingAssignment } from "./billing-source";
import { MockPaymentProvider } from "./mock-provider";
import { evaluateRefund, REFUND_BLOCK_MESSAGES, type RefundReason } from "./refunds";
import { StripeApiError, StripeTestProvider } from "./stripe-provider";
import { HANDLED_EVENTS, type PaymentProvider, type PCheckoutSession, type PEvent } from "./types";

/**
 * Pagamentos (Fase 9.1): contratação, tratamento de eventos e conciliação.
 * Regras:
 * - empresa sempre da sessão (quem chama passa o tenant já validado);
 * - preço, desconto e franquia sempre do catálogo APROVADO no servidor;
 * - acesso só depois de o servidor confirmar o pagamento NO PROVEDOR (o
 *   retorno da página e o conteúdo do evento nunca bastam);
 * - cada evento é processado uma vez (chave = id do evento);
 * - modo live não existe (config + CHECK no banco).
 */
export function getProvider(): PaymentProvider | null {
  const st = getPaymentsStatus();
  if (!st.enabled) return null;
  return st.provider === "stripe_test" ? new StripeTestProvider() : new MockPaymentProvider();
}

const admin = () => createAdminClient();
const subMode = (p: PaymentProvider) => (p.mode === "test" ? "stripe_test" : "simulado");
const shortError = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : "erro").slice(0, 300);
const iso = (sec: number | null) => (sec ? new Date(sec * 1000).toISOString() : null);

async function audit(actor: string | null, tenantId: string | null, action: string, entityId: string, metadata: Record<string, unknown>) {
  await admin().from("audit_log").insert({ actor_id: actor, tenant_id: tenantId, action, entity: "payments", entity_id: entityId, metadata });
}

type PlanRow = { id: string; sku: string; name: string; version: number };

/** Preço no provedor para a versão aprovada do plano e a variante de desconto (reaproveita se já existe). */
async function ensurePlanPrice(provider: PaymentProvider, plan: PlanRow, discount: number, amount: number): Promise<string> {
  const db = admin();
  const { data: price } = await db.from("payment_prices").select("provider_price_id").eq("plan_id", plan.id).eq("plan_version", plan.version).eq("mode", provider.mode).eq("discount_bp", discount).maybeSingle();
  if (price) return price.provider_price_id;
  const p = await provider.ensurePrice({ lookupKey: priceLookupKey(plan.sku, plan.version, discount), productName: `${plan.name}${discount ? ` (combo -${discount / 100}%)` : ""}`, amountCents: amount, recurring: true });
  await db.from("payment_prices").upsert(
    { plan_id: plan.id, plan_version: plan.version, mode: provider.mode, discount_bp: discount, unit_amount_cents: amount, provider_price_id: p.priceId, provider_product_id: p.productId },
    { onConflict: "plan_id,plan_version,mode,discount_bp", ignoreDuplicates: true },
  );
  return p.priceId;
}

/** Retrato do plano na versão em que o preço foi criado (para a assinatura local seguir o preço vigente na Stripe). */
async function planSnapshotForPrice(providerPriceId: string) {
  const db = admin();
  const { data: price } = await db.from("payment_prices").select("plan_id, plan_version, discount_bp").eq("provider_price_id", providerPriceId).maybeSingle();
  if (!price) return null;
  const { data: plan } = await db.from("commercial_plans").select("*").eq("id", price.plan_id).single();
  let snap = plan ? { sku: plan.sku, monthly: plan.monthly_cents, quota: plan.quota, overage: plan.overage_cents, version: plan.version } : null;
  if (plan && plan.version !== price.plan_version) {
    const { data: ch } = await db.from("commercial_plan_changes").select("after").eq("plan_id", price.plan_id).eq("after->>version", String(price.plan_version)).limit(1).maybeSingle();
    const a = (ch?.after ?? null) as { sku?: string; monthly_cents?: number | null; quota?: number | null; overage_cents?: number | null } | null;
    if (a) snap = { sku: a.sku ?? plan.sku, monthly: a.monthly_cents ?? null, quota: a.quota ?? null, overage: a.overage_cents ?? null, version: price.plan_version };
  }
  return snap ? { planId: price.plan_id, discountBp: price.discount_bp, ...snap } : null;
}

/**
 * Origens de cobrança da empresa (0038). Sem a tabela (migration ainda não
 * aplicada), segue como antes: lista vazia, porque nada pode ter sido
 * registrado. Qualquer outro erro = "indisponivel" (falha fechada).
 */
async function billingAssignments(tenantId: string): Promise<BillingAssignment[] | "indisponivel"> {
  const { data, error } = await admin().from("billing_source_assignments").select("service_key, source, status").eq("tenant_id", tenantId).eq("status", "ativa");
  if (error) return error.code === "42P01" || error.code === "PGRST205" ? [] : "indisponivel";
  return (data ?? []) as BillingAssignment[];
}

/** Marca a Stripe como origem ativa do serviço (idempotente: o índice único barra duplicata). */
async function registerStripeBilling(tenantId: string, serviceKey: string, reference: string, actor: string | null) {
  const { error } = await admin().from("billing_source_assignments").insert({ tenant_id: tenantId, service_key: serviceKey, source: "stripe", external_reference: reference.slice(0, 120), created_by: actor });
  // 23505 = já existe origem ativa (a própria Stripe, de uma confirmação anterior); 42P01/PGRST205 = 0038 não aplicada.
  if (error && !["23505", "42P01", "PGRST205"].includes(error.code ?? "")) throw new Error(`origem de cobrança: ${error.code}`);
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function startCheckout(input: { userId: string; tenantId: string; sku: string; accepted: AcceptanceDocument[]; baseUrl: string }): Promise<CheckoutResult> {
  const provider = getProvider();
  if (!provider) return { ok: false, error: "Pagamentos indisponíveis." };
  const missing = (Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).filter((d) => !input.accepted.includes(d));
  if (missing.length) return { ok: false, error: "Marque todos os aceites para continuar." };
  const db = admin();

  const { data: plan } = await db.from("commercial_plans").select("*").eq("sku", input.sku).eq("status", "approved").eq("product", "emissao").maybeSingle();
  if (!plan) return { ok: false, error: "Plano não encontrado." };
  if (plan.monthly_cents === null || plan.overage_cents === null) return { ok: false, error: "Este plano é sob proposta: fale com a equipe comercial." };

  // Fase 10F: o plano de emissão não pode estar sendo cobrado em outro lugar.
  const billing = await billingAssignments(input.tenantId);
  if (billing === "indisponivel") return { ok: false, error: "Não foi possível conferir a forma de cobrança. Tente de novo em instantes." };
  const check = canChargeWithStripe(billing, "nfse_plano");
  if (!check.ok) return { ok: false, error: blockedMessage(check.activeSource) };

  const { data: open } = await db.from("commercial_subscriptions").select("id, status").eq("tenant_id", input.tenantId).neq("status", "cancelada").maybeSingle();
  if (open) return { ok: false, error: open.status === "pendente_pagamento" ? "Já existe um pagamento em andamento para esta empresa." : "A empresa já tem um plano." };

  const { data: account } = await db.from("commercial_accounts").select("relationship").eq("tenant_id", input.tenantId).maybeSingle();
  const snap = { sku: plan.sku, monthlyCents: plan.monthly_cents, quota: plan.quota, overageCents: plan.overage_cents };
  const kind = isPerNotePlan(snap) ? "setup" : "subscription";
  const discount = kind === "subscription" ? comboDiscountBp(account?.relationship === "contabilidade", await getComboDiscountBp()) : 0;
  const amount = monthlyWithDiscount(snap, discount) ?? 0;
  if (!account) await db.from("commercial_accounts").insert({ tenant_id: input.tenantId, relationship: "somente_emissao" });

  // Cliente no provedor: um por empresa.
  let { data: customer } = await db.from("payment_customers").select("provider_customer_id").eq("tenant_id", input.tenantId).maybeSingle();
  if (!customer) {
    const id = await provider.ensureCustomer({ tenantId: input.tenantId, idempotencyKey: `customer:${input.tenantId}` });
    await db.from("payment_customers").upsert({ tenant_id: input.tenantId, mode: provider.mode, provider_customer_id: id }, { onConflict: "tenant_id", ignoreDuplicates: true });
    ({ data: customer } = await db.from("payment_customers").select("provider_customer_id").eq("tenant_id", input.tenantId).maybeSingle());
  }
  if (!customer) return { ok: false, error: "Não foi possível preparar o pagamento." };

  // Preço no provedor da versão aprovada (e variante do combo).
  const priceId = kind === "subscription" ? await ensurePlanPrice(provider, plan, discount, amount) : null;

  const { start, end } = cycleFor(toIsoDate(new Date()));
  const { data: sub, error: subErr } = await db
    .from("commercial_subscriptions")
    .insert({ tenant_id: input.tenantId, plan_id: plan.id, plan_sku: plan.sku, mode: subMode(provider), status: "pendente_pagamento", monthly_cents: plan.monthly_cents, quota: plan.quota, overage_cents: plan.overage_cents, discount_bp: discount, cycle_start: start, cycle_end: end, created_by: input.userId })
    .select("id")
    .single();
  if (subErr || !sub) return { ok: false, error: subErr?.code === "23505" ? "Já existe um plano ou pagamento em andamento." : "Não foi possível iniciar a contratação." };

  await db.from("commercial_acceptances").insert(
    (Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).map((d) => ({ tenant_id: input.tenantId, subscription_id: sub.id, user_id: input.userId, document: d, document_version: ACCEPTANCE_DOCUMENTS[d].version })),
  );
  const { data: checkout } = await db
    .from("payment_checkouts")
    .insert({ tenant_id: input.tenantId, subscription_id: sub.id, plan_id: plan.id, plan_version: plan.version, kind, mode: provider.mode, amount_cents: amount, discount_bp: discount, created_by: input.userId })
    .select("id")
    .single();
  if (!checkout) return { ok: false, error: "Não foi possível iniciar a contratação." };

  // Fase 10E: Pix Automático e boleto, se configurados (desligados por padrão).
  const methods = checkoutMethodOptionsFromEnv();
  if (methods.problems.length) return { ok: false, error: "Configuração de pagamento inválida. Avise a equipe da WJB." };
  try {
    const session = await provider.createCheckoutSession({
      kind,
      methodOptions: methods.options,
      customerId: customer.provider_customer_id,
      priceId,
      successUrl: `${input.baseUrl}/portal/plano?pagamento=retorno`,
      cancelUrl: `${input.baseUrl}/portal/plano?pagamento=cancelado`,
      clientReferenceId: checkout.id,
      metadata: { wjb_tenant: input.tenantId, wjb_checkout: checkout.id, wjb_plan: plan.sku },
      idempotencyKey: `checkout:${checkout.id}`,
    });
    await db.from("payment_checkouts").update({ provider_session_id: session.id }).eq("id", checkout.id);
    await audit(input.userId, input.tenantId, "payments.checkout_started", checkout.id, { sku: plan.sku, kind, amount_cents: amount, discount_bp: discount, mode: provider.mode });
    return { ok: true, url: session.url };
  } catch (e) {
    await db.from("payment_checkouts").update({ status: "cancelado" }).eq("id", checkout.id);
    await db.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "falha ao criar o checkout" }).eq("id", sub.id);
    await audit(input.userId, input.tenantId, "payments.checkout_failed", checkout.id, { error: shortError(e) });
    return { ok: false, error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." };
  }
}

/** Desiste do pagamento em andamento (libera a empresa para contratar de novo). */
export async function cancelPendingCheckout(input: { userId: string; tenantId: string }) {
  const provider = getProvider();
  const db = admin();
  const { data: sub } = await db.from("commercial_subscriptions").select("id").eq("tenant_id", input.tenantId).eq("status", "pendente_pagamento").maybeSingle();
  if (!sub) return false;
  const { data: checkouts } = await db.from("payment_checkouts").select("id, provider_session_id").eq("subscription_id", sub.id).eq("status", "aberto");
  for (const c of checkouts ?? []) {
    if (provider && c.provider_session_id) await provider.expireCheckoutSession(c.provider_session_id).catch(() => undefined);
    await db.from("payment_checkouts").update({ status: "cancelado" }).eq("id", c.id);
  }
  await db.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "pagamento não concluído" }).eq("id", sub.id).eq("status", "pendente_pagamento");
  await audit(input.userId, input.tenantId, "payments.checkout_abandoned", sub.id, {});
  return true;
}

// ---------------- Eventos ----------------

async function tenantByCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin().from("payment_customers").select("tenant_id").eq("provider_customer_id", customerId).maybeSingle();
  return data?.tenant_id ?? null;
}

/** Aplica o estado ATUAL de uma assinatura do provedor à assinatura local. */
async function syncSubscription(provider: PaymentProvider, providerSubId: string, tenantHint: string | null): Promise<string | null> {
  const db = admin();
  const ps = await provider.getSubscription(providerSubId);
  const tenantId = tenantHint ?? (await tenantByCustomer(ps.customerId));
  if (!tenantId) return null;
  let { data: local } = await db.from("commercial_subscriptions").select("id, status, tenant_id").eq("provider_subscription_id", providerSubId).maybeSingle();
  if (!local) {
    // Primeira notícia desta assinatura: vincula à contratação pendente da MESMA empresa (dona do cliente no provedor).
    ({ data: local } = await db.from("commercial_subscriptions").select("id, status, tenant_id").eq("tenant_id", tenantId).eq("status", "pendente_pagamento").maybeSingle());
    if (!local) return tenantId;
  }
  if (local.tenant_id !== tenantId) throw new Error("assinatura de outra empresa");
  const status = nextStatus(local.status, mapSubscriptionStatus(ps.status));
  // A assinatura local segue o preço VIGENTE na Stripe (troca de plano feita aqui ou no portal).
  const plan = ps.priceId ? await planSnapshotForPrice(ps.priceId) : null;
  await db
    .from("commercial_subscriptions")
    .update({
      ...(plan ? { plan_id: plan.planId, plan_sku: plan.sku, monthly_cents: plan.monthly, quota: plan.quota, overage_cents: plan.overage, discount_bp: plan.discountBp, pending_plan_id: null } : {}),
      provider_subscription_id: providerSubId,
      status,
      current_period_end: iso(ps.currentPeriodEnd),
      cancel_at_period_end: ps.cancelAtPeriodEnd,
      ...(status === "cancelada" && local.status !== "cancelada" ? { canceled_at: new Date().toISOString(), cancel_reason: "cancelada no provedor de pagamento" } : {}),
    })
    .eq("id", local.id);
  if (status === "cancelada" && local.status !== "cancelada") {
    // Fase 10F: assinatura encerrada = a Stripe deixa de ser a origem de cobrança.
    await db
      .from("billing_source_assignments")
      .update({ status: "encerrada", ended_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("service_key", "nfse_plano")
      .eq("source", "stripe")
      .eq("status", "ativa");
  }
  return tenantId;
}

async function applySession(provider: PaymentProvider, s: PCheckoutSession): Promise<string | null> {
  const db = admin();
  const { data: c } = await db.from("payment_checkouts").select("*").eq("provider_session_id", s.id).maybeSingle();
  if (!c) return null;
  const { data: cust } = await db.from("payment_customers").select("provider_customer_id").eq("tenant_id", c.tenant_id).maybeSingle();
  // A sessão precisa ser desta contratação e do cliente desta empresa.
  if (s.clientReferenceId !== c.id || (s.customerId && cust?.provider_customer_id !== s.customerId)) throw new Error("sessão não corresponde à contratação");
  if (s.status === "expired") {
    if (c.status === "aberto") await db.from("payment_checkouts").update({ status: "expirado" }).eq("id", c.id);
    await db.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "checkout expirado" }).eq("id", c.subscription_id).eq("status", "pendente_pagamento");
    return c.tenant_id;
  }
  if (!sessionIsPaid(s)) return c.tenant_id; // pagamento assíncrono ainda pendente
  if (c.kind === "subscription") {
    if (s.subscriptionId) await syncSubscription(provider, s.subscriptionId, c.tenant_id);
  } else {
    // Nota avulsa: forma de pagamento cadastrada, nada cobrado agora (só nota oficial autorizada será cobrada).
    await db.from("commercial_subscriptions").update({ status: "ativa_teste" }).eq("id", c.subscription_id).eq("status", "pendente_pagamento");
  }
  if (c.status === "aberto") await db.from("payment_checkouts").update({ status: "concluido", completed_at: new Date().toISOString() }).eq("id", c.id);
  // Fase 10F: pagamento confirmado no provedor = a Stripe passa a ser a origem
  // de cobrança ativa do plano de emissão desta empresa.
  await registerStripeBilling(c.tenant_id, "nfse_plano", `checkout:${c.id}`, c.created_by ?? null);
  return c.tenant_id;
}

async function applyInvoice(provider: PaymentProvider, invoiceId: string): Promise<string | null> {
  const db = admin();
  const inv = await provider.getInvoice(invoiceId);
  if (inv.currency && inv.currency !== "brl") throw new Error("fatura fora de BRL");
  const tenantId = await tenantByCustomer(inv.customerId);
  if (!tenantId) return null;
  if (inv.subscriptionId) await syncSubscription(provider, inv.subscriptionId, tenantId);
  const { data: local } = inv.subscriptionId
    ? await db.from("commercial_subscriptions").select("id").eq("provider_subscription_id", inv.subscriptionId).maybeSingle()
    : { data: null };
  await db.from("payment_invoices").upsert({
    provider_invoice_id: inv.id,
    tenant_id: tenantId,
    subscription_id: local?.id ?? null,
    mode: provider.mode,
    status: mapInvoiceStatus(inv.status),
    amount_due_cents: inv.amountDueCents,
    amount_paid_cents: inv.amountPaidCents,
    period_start: iso(inv.periodStart),
    period_end: iso(inv.periodEnd),
    hosted_invoice_url: inv.hostedInvoiceUrl?.startsWith("https://") ? inv.hostedInvoiceUrl : null,
    updated_at: new Date().toISOString(),
  });
  return tenantId;
}

async function applyCharge(provider: PaymentProvider, chargeId: string): Promise<string | null> {
  const db = admin();
  const ch = await provider.getCharge(chargeId);
  const tenantId = await tenantByCustomer(ch.customerId);
  if (ch.invoiceId && tenantId) {
    await db.from("payment_invoices").update({ amount_refunded_cents: ch.amountRefundedCents, disputed: ch.disputed, updated_at: new Date().toISOString() }).eq("provider_invoice_id", ch.invoiceId).eq("tenant_id", tenantId);
  }
  return tenantId;
}

export type EventOutcome = "processado" | "ignorado" | "repetido" | "falhou" | "recusado";

/** Trata um evento (webhook real ou provedor simulado). Idempotente por id. */
export async function handlePaymentEvent(event: PEvent, provider: PaymentProvider | null = getProvider()): Promise<EventOutcome> {
  if (!provider) return "recusado";
  if (event.livemode) return "recusado";
  const db = admin();
  const objectId = event.relatedChargeId ?? event.objectId;
  const { error: insErr } = await db.from("payment_events").insert({ provider_event_id: event.id, mode: provider.mode, type: event.type.slice(0, 100), object_id: objectId });
  if (insErr) {
    if (insErr.code !== "23505") return "falhou";
    const { data: prev } = await db.from("payment_events").select("status, attempts").eq("provider_event_id", event.id).single();
    if (prev && (prev.status === "processado" || prev.status === "ignorado")) return "repetido";
    await db.from("payment_events").update({ attempts: (prev?.attempts ?? 1) + 1 }).eq("provider_event_id", event.id);
  }
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type) || !objectId) {
    await db.from("payment_events").update({ status: "ignorado", processed_at: new Date().toISOString() }).eq("provider_event_id", event.id);
    return "ignorado";
  }
  try {
    let tenantId: string | null = null;
    if (event.type.startsWith("checkout.session.")) tenantId = await applySession(provider, await provider.getCheckoutSession(objectId));
    else if (event.type.startsWith("invoice.")) tenantId = await applyInvoice(provider, objectId);
    else if (event.type.startsWith("customer.subscription.")) tenantId = await syncSubscription(provider, objectId, null);
    else if (event.type.startsWith("charge.")) tenantId = await applyCharge(provider, objectId);
    await db.from("payment_events").update({ status: tenantId ? "processado" : "ignorado", tenant_id: tenantId, last_error: null, processed_at: new Date().toISOString() }).eq("provider_event_id", event.id);
    return tenantId ? "processado" : "ignorado";
  } catch (e) {
    await db.from("payment_events").update({ status: "falhou", last_error: shortError(e) }).eq("provider_event_id", event.id);
    return "falhou";
  }
}

/**
 * Conciliação: confere no provedor os checkouts abertos e as assinaturas
 * vivas e reprocessa eventos que falharam (até 5 tentativas). Nunca cria
 * cobrança: só lê o provedor e atualiza o estado local.
 */
export async function reconcilePayments(): Promise<{ checkouts: number; subscriptions: number; retried: number; pulled: number; errors: number }> {
  const provider = getProvider();
  const out = { checkouts: 0, subscriptions: 0, retried: 0, pulled: 0, errors: 0 };
  if (!provider) return out;
  const db = admin();
  try {
    const p = await pullProviderEvents(Math.floor(Date.now() / 1000) - 3 * 24 * 3600, provider);
    out.pulled = p.pulled;
    out.errors += p.failed;
  } catch {
    out.errors++;
  }
  const { data: openCk } = await db.from("payment_checkouts").select("provider_session_id, created_at").eq("status", "aberto").eq("mode", provider.mode).not("provider_session_id", "is", null).limit(200);
  for (const c of openCk ?? []) {
    try {
      let s = await provider.getCheckoutSession(c.provider_session_id!);
      if (s.status === "open" && Date.now() - new Date(c.created_at).getTime() > 24 * 3600_000) {
        await provider.expireCheckoutSession(s.id);
        s = await provider.getCheckoutSession(s.id);
      }
      await applySession(provider, s);
      out.checkouts++;
    } catch {
      out.errors++;
    }
  }
  const { data: subs } = await db.from("commercial_subscriptions").select("provider_subscription_id, tenant_id").not("provider_subscription_id", "is", null).neq("status", "cancelada").limit(500);
  for (const s of subs ?? []) {
    try {
      await syncSubscription(provider, s.provider_subscription_id!, s.tenant_id);
      out.subscriptions++;
    } catch {
      out.errors++;
    }
  }
  const { data: failed } = await db.from("payment_events").select("provider_event_id, type, object_id, attempts").eq("status", "falhou").eq("mode", provider.mode).lt("attempts", 5).limit(100);
  for (const f of failed ?? []) {
    const r = await handlePaymentEvent({ id: f.provider_event_id, type: f.type, livemode: false, objectId: f.object_id }, provider);
    out.retried++;
    if (r === "falhou") out.errors++;
  }
  return out;
}

// ---------------- Troca de plano (assinatura paga) ----------------

type ChangeContext = { provider: PaymentProvider; customerId: string; providerSubId: string; newPriceId: string; newPlan: { name: string; sku: string } };

async function prepareChange(tenantId: string, sku: string): Promise<ChangeContext | { error: string }> {
  const provider = getProvider();
  if (!provider) return { error: "Pagamentos indisponíveis." };
  const db = admin();
  const { data: sub } = await db.from("commercial_subscriptions").select("plan_sku, status, provider_subscription_id, cancel_at_period_end").eq("tenant_id", tenantId).neq("status", "cancelada").maybeSingle();
  if (!sub?.provider_subscription_id || sub.status !== "ativa_teste") return { error: "A troca exige um plano pago ativo e em dia." };
  if (sub.cancel_at_period_end) return { error: "Há um cancelamento agendado: desfaça-o com a equipe antes de trocar." };
  if (sub.plan_sku === sku) return { error: "Esse já é o plano atual." };
  const { data: plan } = await db.from("commercial_plans").select("*").eq("sku", sku).eq("status", "approved").eq("product", "emissao").maybeSingle();
  if (!plan || plan.monthly_cents === null || plan.overage_cents === null) return { error: "Plano não disponível para troca." };
  const snap = { sku: plan.sku, monthlyCents: plan.monthly_cents, quota: plan.quota, overageCents: plan.overage_cents };
  if (isPerNotePlan(snap)) return { error: "Para a Nota Avulsa, cancele o plano atual e contrate de novo." };
  const { data: account } = await db.from("commercial_accounts").select("relationship").eq("tenant_id", tenantId).maybeSingle();
  const discount = comboDiscountBp(account?.relationship === "contabilidade", await getComboDiscountBp());
  const amount = monthlyWithDiscount(snap, discount) ?? 0;
  const { data: cust } = await db.from("payment_customers").select("provider_customer_id").eq("tenant_id", tenantId).maybeSingle();
  if (!cust) return { error: "Cliente de pagamento não encontrado." };
  const newPriceId = await ensurePlanPrice(provider, plan, discount, amount);
  return { provider, customerId: cust.provider_customer_id, providerSubId: sub.provider_subscription_id, newPriceId, newPlan: { name: plan.name, sku: plan.sku } };
}

/** Valor cobrado agora (diferença proporcional) se a troca for confirmada. Nada é alterado. */
export async function previewPaidPlanChange(tenantId: string, sku: string): Promise<{ ok: true; amountDueCents: number; planName: string } | { ok: false; error: string }> {
  const c = await prepareChange(tenantId, sku);
  if ("error" in c) return { ok: false, error: c.error };
  const p = await c.provider.previewPriceChange({ customerId: c.customerId, subscriptionId: c.providerSubId, newPriceId: c.newPriceId });
  return { ok: true, amountDueCents: p.amountDueCents, planName: c.newPlan.name };
}

export async function changePaidPlan(input: { userId: string; tenantId: string; sku: string }): Promise<{ ok: true; planName: string } | { ok: false; error: string }> {
  const c = await prepareChange(input.tenantId, input.sku);
  if ("error" in c) return { ok: false, error: c.error };
  const key = createHash("sha256").update(`change:${c.providerSubId}:${c.newPriceId}`).digest("hex").slice(0, 40);
  try {
    const r = await c.provider.changeSubscriptionPrice({ subscriptionId: c.providerSubId, newPriceId: c.newPriceId, idempotencyKey: key });
    await syncSubscription(c.provider, c.providerSubId, input.tenantId);
    if (r.invoiceId) await applyInvoice(c.provider, r.invoiceId);
  } catch (e) {
    await audit(input.userId, input.tenantId, "payments.plan_change_failed", c.providerSubId, { to_sku: c.newPlan.sku, error: shortError(e) });
    return { ok: false, error: "A troca não foi concluída (pagamento da diferença recusado ou indisponível). Nada mudou." };
  }
  await audit(input.userId, input.tenantId, "payments.plan_changed", c.providerSubId, { to_sku: c.newPlan.sku });
  return { ok: true, planName: c.newPlan.name };
}

/** Busca eventos recentes no provedor e trata os que faltarem (reserva para webhook perdido). */
export async function pullProviderEvents(createdGte: number, provider: PaymentProvider | null = getProvider()) {
  const out = { pulled: 0, processed: 0, duplicates: 0, failed: 0 };
  if (!provider) return out;
  for (const e of await provider.listEvents({ createdGte })) {
    out.pulled++;
    const r = await handlePaymentEvent(e, provider);
    if (r === "processado") out.processed++;
    else if (r === "repetido") out.duplicates++;
    else if (r === "falhou") out.failed++;
  }
  return out;
}

export async function openBillingPortal(tenantId: string, returnUrl: string): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  const { data: c } = await admin().from("payment_customers").select("provider_customer_id").eq("tenant_id", tenantId).maybeSingle();
  if (!c) return null;
  return (await provider.createPortalSession({ customerId: c.provider_customer_id, returnUrl })).url;
}

/** Cancela a assinatura paga ao fim do período (o webhook confirma e atualiza). */
export async function cancelPaidSubscription(input: { userId: string; tenantId: string; subscriptionId: string; providerSubscriptionId: string }) {
  const provider = getProvider();
  if (!provider) return false;
  const key = createHash("sha256").update(`cancel:${input.providerSubscriptionId}`).digest("hex").slice(0, 40);
  await provider.cancelSubscription({ subscriptionId: input.providerSubscriptionId, atPeriodEnd: true, idempotencyKey: key });
  await syncSubscription(provider, input.providerSubscriptionId, input.tenantId);
  await audit(input.userId, input.tenantId, "payments.cancel_requested", input.subscriptionId, { at_period_end: true });
  return true;
}

// ---------------- Reembolso (Fase 10F) ----------------
export type RefundResult = { ok: true; status: string; amountCents: number } | { ok: false; error: string };

/**
 * Reembolso de uma fatura paga. A empresa vem de quem chama (já validada) e
 * tudo o que decide o reembolso (valor pago, saldo, meio, contestação) é
 * buscado DE NOVO no provedor, nunca do banco local nem do formulário.
 */
export async function requestRefund(input: {
  userId: string;
  tenantId: string;
  providerInvoiceId: string;
  amountCents: number;
  reason: RefundReason;
}): Promise<RefundResult> {
  const provider = getProvider();
  if (!provider) return { ok: false, error: "Pagamentos indisponíveis." };
  const db = admin();
  const { data: local } = await db
    .from("payment_invoices")
    .select("provider_invoice_id, tenant_id")
    .eq("provider_invoice_id", input.providerInvoiceId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!local) return { ok: false, error: "Fatura não encontrada para esta empresa." };
  let charge: Awaited<ReturnType<PaymentProvider["getCharge"]>>;
  let decision: ReturnType<typeof evaluateRefund>;
  try {
    const inv = await provider.getInvoice(input.providerInvoiceId);
    if ((await tenantByCustomer(inv.customerId)) !== input.tenantId) return { ok: false, error: "Fatura não encontrada para esta empresa." };
    if (!inv.chargeId) return { ok: false, error: "A fatura não tem cobrança paga para reembolsar." };
    charge = await provider.getCharge(inv.chargeId);
    if (charge.invoiceId && charge.invoiceId !== input.providerInvoiceId) return { ok: false, error: "A cobrança não pertence a esta fatura." };
    decision = evaluateRefund(charge, input.amountCents, input.reason);
  } catch (e) {
    await audit(input.userId, input.tenantId, "payments.refund_failed", input.providerInvoiceId, { stage: "consulta", error: shortError(e).slice(0, 120) });
    return { ok: false, error: "Não foi possível consultar a cobrança no provedor. Nada foi devolvido." };
  }
  if (!decision.ok) {
    await audit(input.userId, input.tenantId, "payments.refund_blocked", input.providerInvoiceId, { code: decision.code });
    return { ok: false, error: REFUND_BLOCK_MESSAGES[decision.code] };
  }
  let refund: Awaited<ReturnType<PaymentProvider["createRefund"]>>;
  try {
    refund = await provider.createRefund({
      chargeId: charge.id,
      amountCents: decision.amountCents,
      reason: decision.stripeReason,
      idempotencyKey: decision.idempotencyKey,
      metadata: { wjb_tenant: input.tenantId, wjb_invoice: input.providerInvoiceId },
    });
  } catch (e) {
    // Recusa explícita da Stripe (4xx com código) = nada foi devolvido. Rede,
    // tempo esgotado ou conflito de idempotência (409, clique simultâneo) =
    // situação INCERTA: a devolução pode ter acontecido.
    const status = e instanceof StripeApiError ? e.status : null;
    const certain = status !== null && status >= 400 && status < 500 && status !== 409;
    await audit(input.userId, input.tenantId, "payments.refund_failed", input.providerInvoiceId, { stage: "reembolso", certain, error: shortError(e).slice(0, 120) });
    return {
      ok: false,
      error: certain
        ? "A Stripe recusou o reembolso. Nada foi devolvido."
        : "Situação incerta: o reembolso pode ter sido feito. Confira na Stripe antes de tentar de novo.",
    };
  }
  // A devolução já aconteceu: daqui em diante, falha só atrasa a sincronização.
  await audit(input.userId, input.tenantId, "payments.refund_requested", input.providerInvoiceId, {
    amount_cents: refund.amountCents,
    status: refund.status,
    reason: input.reason,
    mode: provider.mode,
  });
  try {
    await applyCharge(provider, charge.id);
  } catch {
    // a conciliação e o evento charge.refunded atualizam a fatura depois
  }
  return { ok: true, status: refund.status, amountCents: refund.amountCents };
}
