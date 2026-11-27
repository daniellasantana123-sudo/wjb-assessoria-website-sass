import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkStripeKeys, stripeKeysFromEnv, STRIPE_API_VERSION } from "@/lib/payments/config";
import { signStripePayload } from "@/lib/payments/signature";
import { encodeForm } from "@/lib/payments/stripe-provider";

/**
 * Fase 9.1: testes REAIS no Sandbox da Stripe (modo de teste), usando o
 * código do próprio serviço (sem cópia) e o Supabase de HOMOLOGAÇÃO.
 * Só roda por `bash scripts/wjb-ai/stripe/sandbox.sh`, com chaves de teste
 * em .env.stripe.local. Usa cartões de teste publicados pela Stripe
 * (pm_card_visa, pm_card_chargeCustomerFail) e Test Clocks para renovação.
 * Não guarda ids nem valores de chave: a evidência só tem contagens e status.
 */
const KEYS = stripeKeysFromEnv();
const READY = process.env.STRIPE_SANDBOX === "1" && checkStripeKeys(KEYS).ok;
const evidence: { passo: string; resultado: string }[] = [];
const note = (passo: string, resultado: string) => evidence.push({ passo, resultado });

async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", p: string, body?: Record<string, unknown>): Promise<T> {
  const q = method === "GET" && body ? `?${encodeForm(body).join("&")}` : "";
  const res = await fetch(`https://api.stripe.com/v1${p}${q}`, {
    method,
    headers: { Authorization: `Bearer ${KEYS.secret}`, "Stripe-Version": STRIPE_API_VERSION, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" && body ? encodeForm(body).join("&") : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe ${res.status} ${(json.error as { code?: string })?.code ?? ""}`);
  if (json.livemode === true) throw new Error("objeto live: abortado");
  return json as T;
}
const db = () => createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

async function advanceClock(clockId: string, to: number) {
  await stripe("POST", `/test_helpers/test_clocks/${clockId}/advance`, { frozen_time: to });
  for (let i = 0; i < 60; i++) {
    const c = await stripe<{ status: string }>("GET", `/test_helpers/test_clocks/${clockId}`);
    if (c.status === "ready") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("test clock não ficou pronto");
}

describe.runIf(READY).sequential("Stripe Sandbox (modo de teste) com o serviço da WJB", () => {
  const started = Math.floor(Date.now() / 1000) - 60;
  const clocks: string[] = [];
  let A = "";
  let B = "";
  let ownerA = "";
  let ownerB = "";
  let customerA = "";
  let subA = "";
  let pmVisa = "";
  let svc: typeof import("@/lib/payments/service");

  async function localSub(tenant: string) {
    const { data } = await db().from("commercial_subscriptions").select("*").eq("tenant_id", tenant).neq("status", "cancelada").maybeSingle();
    return data;
  }
  async function entitled(tenant: string) {
    const { data } = await db().rpc("has_entitlement", { p_tenant_id: tenant, p_feature: "nfse" });
    return data === true;
  }
  async function pull() {
    return svc.pullProviderEvents(started);
  }
  async function clockedCustomer(tenant: string, pm: string) {
    const now = Math.floor(Date.now() / 1000);
    const clock = await stripe<{ id: string }>("POST", "/test_helpers/test_clocks", { frozen_time: now, name: "WJB sandbox" });
    clocks.push(clock.id);
    const cus = await stripe<{ id: string }>("POST", "/customers", { test_clock: clock.id, metadata: { wjb_tenant: tenant, wjb_sandbox: "1" } });
    const attached = await stripe<{ id: string }>("POST", `/payment_methods/${pm}/attach`, { customer: cus.id });
    await stripe("POST", `/customers/${cus.id}`, { invoice_settings: { default_payment_method: attached.id } });
    await db().from("payment_customers").delete().eq("tenant_id", tenant);
    await db().from("payment_customers").insert({ tenant_id: tenant, mode: "test", provider_customer_id: cus.id });
    return { clock: clock.id, customer: cus.id, pm: attached.id };
  }

  beforeAll(async () => {
    svc = await import("@/lib/payments/service");
    const { data: ts } = await db().from("tenants").select("id, name").in("name", ["Empresa Ficticia A", "Empresa Ficticia B"]);
    A = ts!.find((t) => t.name === "Empresa Ficticia A")!.id;
    B = ts!.find((t) => t.name === "Empresa Ficticia B")!.id;
    const { data: ms } = await db().from("tenant_members").select("tenant_id, user_id, role").in("tenant_id", [A, B]).eq("role", "owner");
    ownerA = ms!.find((m) => m.tenant_id === A)!.user_id;
    ownerB = ms!.find((m) => m.tenant_id === B)!.user_id;
    await db().from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "início do sandbox" }).in("tenant_id", [A, B]).neq("status", "cancelada");
    await db().from("commercial_accounts").upsert({ tenant_id: A, relationship: "contabilidade" });
  }, 120_000);

  afterAll(async () => {
    for (const c of clocks) await stripe("DELETE", `/test_helpers/test_clocks/${c}`).catch(() => undefined); // apaga clientes e assinaturas de teste
    if (A && B) {
      await db().from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "fim do sandbox" }).in("tenant_id", [A, B]).neq("status", "cancelada");
      await db().from("payment_customers").delete().in("tenant_id", [A, B]).eq("mode", "test");
    }
    mkdirSync(path.join(process.cwd(), "docs/wjb-ai/evidencias/f91"), { recursive: true });
    writeFileSync(path.join(process.cwd(), "docs/wjb-ai/evidencias/f91/sandbox-resultado.json"), JSON.stringify({ geradoEm: new Date().toISOString(), ambiente: "Stripe modo de teste + Supabase de homologação", apiVersion: STRIPE_API_VERSION, passos: evidence }, null, 1));
  }, 120_000);

  it("1. Checkout real: assinatura em BRL com 20% calculado no servidor; desistir expira a sessão", async () => {
    const r = await svc.startCheckout({ userId: ownerA, tenantId: A, sku: "nfse_mei", accepted: ["termos_emissao", "privacidade", "precos_franquia", "representacao_fiscal"], baseUrl: "http://localhost:3000" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new URL(r.url).hostname).toBe("checkout.stripe.com");
    const { data: ck } = await db().from("payment_checkouts").select("id, provider_session_id").eq("tenant_id", A).order("created_at", { ascending: false }).limit(1).single();
    const s = await stripe<{ mode: string; amount_total: number; currency: string; client_reference_id: string; payment_method_types: string[] }>("GET", `/checkout/sessions/${ck!.provider_session_id}`);
    expect(s).toMatchObject({ mode: "subscription", amount_total: 1992, currency: "brl", client_reference_id: ck!.id });
    note("checkout", `modo ${s.mode}, R$ ${(s.amount_total / 100).toFixed(2)}, meios: ${s.payment_method_types.join("/")}${s.payment_method_types.includes("link") ? " (Link disponível)" : " (Link não oferecido nesta conta)"}`);
    await svc.cancelPendingCheckout({ userId: ownerA, tenantId: A });
    const after = await stripe<{ status: string }>("GET", `/checkout/sessions/${ck!.provider_session_id}`);
    expect(after.status).toBe("expired");
    expect(await localSub(A)).toBeNull();
  }, 120_000);

  it("2. Pagamento aprovado (cartão de teste 4242): assinatura ativa, fatura paga, direito de uso", async () => {
    const c = await clockedCustomer(A, "pm_card_visa");
    customerA = c.customer;
    pmVisa = c.pm;
    const r = await svc.startCheckout({ userId: ownerA, tenantId: A, sku: "nfse_mei", accepted: ["termos_emissao", "privacidade", "precos_franquia", "representacao_fiscal"], baseUrl: "http://localhost:3000" });
    expect(r.ok).toBe(true);
    const { data: mei } = await db().from("commercial_plans").select("id, version").eq("sku", "nfse_mei").single();
    const { data: price } = await db().from("payment_prices").select("provider_price_id, unit_amount_cents").eq("mode", "test").eq("plan_id", mei!.id).eq("plan_version", mei!.version).eq("discount_bp", 2000).single();
    expect(price!.unit_amount_cents).toBe(1992);
    // Equivale ao cliente concluir o checkout (sem automatizar a página da Stripe).
    const sub = await stripe<{ id: string; status: string }>("POST", "/subscriptions", { customer: customerA, items: [{ price: price!.provider_price_id }], default_payment_method: pmVisa, metadata: { wjb_tenant: A } });
    subA = sub.id;
    expect(sub.status).toBe("active");
    const p = await pull();
    expect(p.failed).toBe(0);
    const local = await localSub(A);
    expect(local).toMatchObject({ status: "ativa_teste", provider_subscription_id: subA, discount_bp: 2000 });
    const { data: inv } = await db().from("payment_invoices").select("status, amount_paid_cents").eq("subscription_id", local!.id);
    expect(inv).toEqual([{ status: "paga", amount_paid_cents: 1992 }]);
    expect(await entitled(A)).toBe(true);
    note("aprovado", `assinatura ${local!.status}, 1 fatura paga de R$ 19,92, direito de uso concedido`);
  }, 180_000);

  it("3. Evento repetido e webhook com evento real assinado não duplicam nada", async () => {
    const again = await pull();
    expect(again.processed).toBe(0);
    expect(again.duplicates).toBeGreaterThan(0);
    const ev = await stripe<{ data: { id: string; type: string }[] }>("GET", "/events", { type: "invoice.paid", limit: 1 });
    const full = await stripe("GET", `/events/${ev.data[0].id}`);
    const raw = JSON.stringify(full);
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const mk = (body: string, sig: string) => new Request("http://localhost/api/payments/stripe/webhook", { method: "POST", body, headers: { "content-type": "application/json", "stripe-signature": sig } });
    const ok = await POST(mk(raw, signStripePayload(raw, KEYS.webhook)) as never);
    expect(await ok.json()).toMatchObject({ outcome: "repetido" });
    const bad = await POST(mk(raw.replace("invoice.paid", "invoice.payment_failed"), signStripePayload(raw, KEYS.webhook)) as never);
    expect(bad.status).toBe(400);
    const local = await localSub(A);
    const { count } = await db().from("payment_invoices").select("provider_invoice_id", { count: "exact", head: true }).eq("subscription_id", local!.id);
    expect(count).toBe(1);
    note("idempotência", `${again.duplicates} evento(s) repetido(s) sem efeito; webhook real assinado = repetido; corpo alterado = 400`);
  }, 120_000);

  it("4. Renovação com Test Clock: segunda fatura paga e período avançado", async () => {
    const s = await stripe<{ current_period_end: number }>("GET", `/subscriptions/${subA}`);
    await advanceClock(clocks[0], s.current_period_end + 7200);
    await pull();
    const local = await localSub(A);
    const { data: inv } = await db().from("payment_invoices").select("status").eq("subscription_id", local!.id);
    expect(inv!.filter((i) => i.status === "paga").length).toBe(2);
    expect(new Date(local!.current_period_end).getTime() / 1000).toBeGreaterThan(s.current_period_end);
    note("renovação", "Test Clock avançou um mês: 2 faturas pagas, período renovado");
  }, 240_000);

  it("5. Troca de plano com valor proporcional mostrado antes", async () => {
    const pv = await svc.previewPaidPlanChange(A, "nfse_profissional");
    expect(pv.ok).toBe(true);
    if (!pv.ok) return;
    expect(pv.amountDueCents).toBeGreaterThan(0);
    const r = await svc.changePaidPlan({ userId: ownerA, tenantId: A, sku: "nfse_profissional" });
    expect(r.ok).toBe(true);
    await pull();
    const local = await localSub(A);
    expect(local).toMatchObject({ plan_sku: "nfse_profissional", quota: 50, discount_bp: 2000, status: "ativa_teste" });
    note("troca de plano", `prévia R$ ${(pv.amountDueCents / 100).toFixed(2)} (proporcional), assinatura local virou Profissional`);
  }, 180_000);

  it("6. Renovação recusada (pm_card_chargeCustomerFail): em atraso, sem direito de uso; 7. regularização reativa", async () => {
    const fail = await stripe<{ id: string }>("POST", "/payment_methods/pm_card_chargeCustomerFail/attach", { customer: customerA });
    await stripe("POST", `/subscriptions/${subA}`, { default_payment_method: fail.id });
    const s = await stripe<{ current_period_end: number }>("GET", `/subscriptions/${subA}`);
    await advanceClock(clocks[0], s.current_period_end + 7200);
    await pull();
    expect((await localSub(A))!.status).toBe("inadimplente");
    expect(await entitled(A)).toBe(false);
    note("recusado na renovação", "fatura não paga, assinatura em atraso, direito de uso suspenso");
    await stripe("POST", `/subscriptions/${subA}`, { default_payment_method: pmVisa });
    const open = await stripe<{ data: { id: string }[] }>("GET", "/invoices", { subscription: subA, status: "open", limit: 1 });
    await stripe("POST", `/invoices/${open.data[0].id}/pay`, { payment_method: pmVisa });
    await pull();
    expect((await localSub(A))!.status).toBe("ativa_teste");
    expect(await entitled(A)).toBe(true);
    note("regularização", "fatura paga com outro cartão, assinatura reativada");
  }, 300_000);

  it("8. Estorno aparece na fatura e 9. conciliação não encontra divergência", async () => {
    const paid = await stripe<{ data: { id: string; charge: string | null; amount_paid: number }[] }>("GET", "/invoices", { subscription: subA, status: "paid", limit: 1 });
    const invoiceId = paid.data[0].id;
    await pull();
    // Fase 10F: reembolso PELO NOSSO SERVIÇO. Dois pedidos simultâneos no mesmo
    // estado = uma devolução só (mesma chave de idempotência na Stripe).
    const [r1, r2] = await Promise.all([
      svc.requestRefund({ userId: ownerA, tenantId: A, providerInvoiceId: invoiceId, amountCents: 100, reason: "pedido_do_cliente" }),
      svc.requestRefund({ userId: ownerA, tenantId: A, providerInvoiceId: invoiceId, amountCents: 100, reason: "pedido_do_cliente" }),
    ]);
    expect([r1.ok, r2.ok]).toContain(true);
    const ch = await stripe<{ amount_refunded: number }>("GET", `/charges/${paid.data[0].charge}`);
    expect(ch.amount_refunded).toBe(100);
    // Outra empresa não reembolsa a fatura de A.
    expect((await svc.requestRefund({ userId: ownerB, tenantId: B, providerInvoiceId: invoiceId, amountCents: 100, reason: "pedido_do_cliente" })).ok).toBe(false);
    // Acima do saldo: recusado pela regra, nada devolvido.
    expect((await svc.requestRefund({ userId: ownerA, tenantId: A, providerInvoiceId: invoiceId, amountCents: paid.data[0].amount_paid, reason: "pedido_do_cliente" })).ok).toBe(false);
    await pull();
    const local = await localSub(A);
    const { data: inv } = await db().from("payment_invoices").select("amount_refunded_cents").eq("subscription_id", local!.id).eq("amount_refunded_cents", 100);
    expect((inv ?? []).length).toBe(1);
    const r = await svc.reconcilePayments();
    expect(r.errors).toBe(0);
    note("reembolso e conciliação", `reembolso parcial pelo serviço (pedido duplo = 1 devolução); conciliação: ${r.subscriptions} assinatura(s) conferida(s), 0 erro`);
  }, 180_000);

  it("10. Cancelamento no fim do período: segue ativo até o fim, depois encerra", async () => {
    const local = await localSub(A);
    await svc.cancelPaidSubscription({ userId: ownerA, tenantId: A, subscriptionId: local!.id, providerSubscriptionId: subA });
    expect((await localSub(A))!.cancel_at_period_end).toBe(true);
    expect(await entitled(A)).toBe(true);
    const s = await stripe<{ current_period_end: number }>("GET", `/subscriptions/${subA}`);
    await advanceClock(clocks[0], s.current_period_end + 7200);
    await pull();
    expect(await localSub(A)).toBeNull();
    expect(await entitled(A)).toBe(false);
    note("cancelamento", "agendado para o fim do período; encerrado após o Test Clock passar a data");
  }, 240_000);

  it("11. Cartão recusado já na contratação: nada é ativado", async () => {
    const c = await clockedCustomer(B, "pm_card_chargeCustomerFail");
    const r = await svc.startCheckout({ userId: ownerB, tenantId: B, sku: "nfse_profissional", accepted: ["termos_emissao", "privacidade", "precos_franquia", "representacao_fiscal"], baseUrl: "http://localhost:3000" });
    expect(r.ok).toBe(true);
    const { data: prof } = await db().from("commercial_plans").select("id, version").eq("sku", "nfse_profissional").single();
    const { data: price } = await db().from("payment_prices").select("provider_price_id").eq("mode", "test").eq("plan_id", prof!.id).eq("plan_version", prof!.version).eq("discount_bp", 0).single();
    const sub = await stripe<{ status: string }>("POST", "/subscriptions", { customer: c.customer, items: [{ price: price!.provider_price_id }], default_payment_method: c.pm, payment_behavior: "allow_incomplete" });
    expect(sub.status).toBe("incomplete");
    await pull();
    expect((await localSub(B))?.status).toBe("pendente_pagamento");
    expect(await entitled(B)).toBe(false);
    note("recusado na contratação", "assinatura incompleta na Stripe, pendente na WJB, sem direito de uso");
  }, 180_000);

  it("12. Tentativa de cobrança duplicada: segundo checkout recusado; serviço cobrado em outra origem também (Fase 10G)", async () => {
    const accepted = ["termos_emissao", "privacidade", "precos_franquia", "representacao_fiscal"] as const;
    // B ficou com uma contratação pendente no cenário 11: um segundo checkout não abre.
    const dup = await svc.startCheckout({ userId: ownerB, tenantId: B, sku: "nfse_profissional", accepted: [...accepted], baseUrl: "http://localhost:3000" });
    expect(dup.ok).toBe(false);
    // A (sem plano aberto depois do cenário 10) com o serviço cobrado por outro meio: recusado antes de falar com a Stripe.
    await db().from("billing_source_assignments").update({ status: "encerrada", ended_at: new Date().toISOString() }).eq("tenant_id", A).eq("status", "ativa");
    const { data: origem } = await db().from("billing_source_assignments").insert({ tenant_id: A, service_key: "nfse_plano", source: "externo", note: "sandbox 10G" }).select("id").single();
    const { count: antes } = await db().from("payment_checkouts").select("id", { count: "exact", head: true }).eq("tenant_id", A);
    const blocked = await svc.startCheckout({ userId: ownerA, tenantId: A, sku: "nfse_mei", accepted: [...accepted], baseUrl: "http://localhost:3000" });
    expect(blocked).toMatchObject({ ok: false });
    const { count: depois } = await db().from("payment_checkouts").select("id", { count: "exact", head: true }).eq("tenant_id", A);
    expect(depois).toBe(antes);
    await db().from("billing_source_assignments").update({ status: "encerrada", ended_at: new Date().toISOString() }).eq("id", origem!.id);
    note("cobrança duplicada", "segundo checkout recusado; serviço com origem externa não abre checkout");
  }, 120_000);

  it("13. Webhook com assinatura velha ou de outro segredo é recusado (Fase 10G)", async () => {
    const ev = await stripe<{ data: { id: string }[] }>("GET", "/events", { limit: 1 });
    const raw = JSON.stringify(await stripe("GET", `/events/${ev.data[0].id}`));
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const mk = (sig: string) => new Request("http://localhost/api/payments/stripe/webhook", { method: "POST", body: raw, headers: { "content-type": "application/json", "stripe-signature": sig } });
    const old = await POST(mk(signStripePayload(raw, KEYS.webhook, Math.floor(Date.now() / 1000) - 3600)) as never);
    expect(old.status).toBe(400);
    const other = await POST(mk(signStripePayload(raw, "whsec_outrosegredoqualquer0000")) as never);
    expect(other.status).toBe(400);
    note("assinatura inválida", "assinatura de 1 h atrás e de outro segredo = 400");
  }, 60_000);
});

describe.skipIf(READY)("Stripe Sandbox", () => {
  it.skip("sem chaves de teste em .env.stripe.local: rode scripts/wjb-ai/stripe/configurar-chaves.mjs", () => undefined);
});
