"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkRecentStepUp, requireStaffSession, STEP_UP_MESSAGES } from "@/lib/auth/dal";
import { ACCEPTANCE_DOCUMENTS, type AcceptanceDocument } from "@/lib/commercial/pricing";
import { requireOwnerContext } from "@/lib/commercial/owner-context";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { getPaymentsStatus, isPaymentsEnabled } from "@/lib/payments/config";
import { mockCancelNow, mockPayCheckout, mockRefundOrDispute, mockRenewal } from "@/lib/payments/mock-provider";
import { isValidServiceKey } from "@/lib/payments/billing-source";
import { parseBrlToCents, type RefundReason } from "@/lib/payments/refunds";
import { cancelPaidSubscription, cancelPendingCheckout, changePaidPlan, getProvider, handlePaymentEvent, openBillingPortal, reconcilePayments, requestRefund, startCheckout } from "@/lib/payments/service";

export interface PaymentActionState {
  error?: string;
  ok?: string;
}

/** Origem da requisição atual (URLs de retorno do checkout apontam para o mesmo ambiente). */
async function origin() {
  const h = await headers();
  // Fase 10F: só o Host, que o proxy já conferiu contra a lista de endereços
  // autorizados. X-Forwarded-Host pode vir do próprio navegador e apontaria o
  // retorno do Checkout para outro domínio.
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function startCheckoutAction(_prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const ctx = await requireOwnerContext("payments");
  if ("error" in ctx) return ctx;
  const accepted = (Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).filter((d) => formData.get(`aceite_${d}`) === "on");
  const r = await startCheckout({ userId: ctx.session.userId, tenantId: ctx.tenantId, sku: String(formData.get("sku") ?? ""), accepted, baseUrl: await origin() });
  if (!r.ok) return { error: r.error };
  redirect(r.url);
}

export async function cancelPendingCheckoutAction(): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const ctx = await requireOwnerContext("payments");
  if ("error" in ctx) return ctx;
  await cancelPendingCheckout({ userId: ctx.session.userId, tenantId: ctx.tenantId });
  revalidatePath("/portal/plano");
  redirect("/portal/plano?pagamento=desistiu");
}

export async function openBillingPortalAction(): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const ctx = await requireOwnerContext("payments");
  if ("error" in ctx) return ctx;
  const url = await openBillingPortal(ctx.tenantId, `${await origin()}/portal/plano`);
  if (!url) return { error: "Ainda não há forma de pagamento cadastrada." };
  redirect(url);
}

export async function cancelPaidSubscriptionAction(_prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const ctx = await requireOwnerContext("payments");
  if ("error" in ctx) return ctx;
  if (formData.get("confirm") !== "on") return { error: "Confirme que entendeu o efeito do cancelamento." };
  const { data: sub } = await createAdminClient().from("commercial_subscriptions").select("id, provider_subscription_id").eq("tenant_id", ctx.tenantId).neq("status", "cancelada").maybeSingle();
  if (!sub?.provider_subscription_id) return { error: "Não há assinatura paga ativa." };
  await cancelPaidSubscription({ userId: ctx.session.userId, tenantId: ctx.tenantId, subscriptionId: sub.id, providerSubscriptionId: sub.provider_subscription_id });
  revalidatePath("/portal/plano");
  return { ok: "Cancelamento agendado para o fim do período já pago (ambiente de teste)." };
}

/** Troca de plano pago (a diferença proporcional é cobrada na hora; o valor foi mostrado antes). */
export async function changePaidPlanAction(_prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const ctx = await requireOwnerContext("payments");
  if ("error" in ctx) return ctx;
  if (formData.get("confirm") !== "on") return { error: "Confirme o valor da troca." };
  const r = await changePaidPlan({ userId: ctx.session.userId, tenantId: ctx.tenantId, sku: String(formData.get("sku") ?? "") });
  if (!r.ok) return { error: r.error };
  revalidatePath("/portal/plano");
  redirect(`/portal/plano?trocado=1`);
}

/** Checkout SIMULADO: só o responsável da empresa dona da sessão, só com provedor simulado. */
export async function mockPayAction(sessionId: string, outcome: "aprovado" | "recusado"): Promise<PaymentActionState> {
  if (getPaymentsStatus().provider !== "mock" || !isPaymentsEnabled()) return { error: "Disponível só no pagamento simulado." };
  const ctx = await requireOwnerContext("payments-mock");
  if ("error" in ctx) return ctx;
  const { data: c } = await createAdminClient().from("payment_checkouts").select("id").eq("provider_session_id", sessionId).eq("tenant_id", ctx.tenantId).eq("status", "aberto").maybeSingle();
  if (!c) return { error: "Pagamento não encontrado." };
  const events = await mockPayCheckout(sessionId, outcome);
  if (outcome === "recusado") return { error: "Cartão recusado (teste). Nada foi ativado. Tente de novo ou desista." };
  const provider = getProvider();
  for (const e of events) await handlePaymentEvent(e, provider);
  revalidatePath("/portal/plano");
  redirect("/portal/plano?pagamento=retorno");
}

// ---------------- Admin ----------------
async function superAdmin() {
  const s = await requireStaffSession();
  return s.staffRole === "super_admin" ? s : null;
}

export async function adminReconcileAction(): Promise<PaymentActionState> {
  if (!isPaymentsEnabled() || !(await superAdmin())) return { error: "Sem permissão." };
  const r = await reconcilePayments();
  revalidatePath("/admin/pagamentos");
  return { ok: `Conciliação: ${r.checkouts} checkout(s), ${r.subscriptions} assinatura(s), ${r.pulled} evento(s) conferido(s) no provedor, ${r.retried} reprocessado(s), ${r.errors} erro(s).` };
}

const MOCK_EVENTS = ["renovacao_paga", "renovacao_falhou", "estorno", "contestacao", "cancelar_agora"] as const;
export async function adminMockEventAction(subscriptionId: string, _prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  if (getPaymentsStatus().provider !== "mock" || !isPaymentsEnabled()) return { error: "Disponível só no pagamento simulado." };
  const admin = await superAdmin();
  if (!admin) return { error: "Sem permissão." };
  const kind = String(formData.get("evento") ?? "") as (typeof MOCK_EVENTS)[number];
  if (!MOCK_EVENTS.includes(kind)) return { error: "Evento inválido." };
  const db = createAdminClient();
  const { data: sub } = await db.from("commercial_subscriptions").select("id, tenant_id, provider_subscription_id").eq("id", subscriptionId).maybeSingle();
  if (!sub?.provider_subscription_id) return { error: "Assinatura sem pagamento vinculado." };
  let events;
  if (kind === "renovacao_paga" || kind === "renovacao_falhou") events = await mockRenewal(sub.provider_subscription_id, kind === "renovacao_paga" ? "paga" : "falhou");
  else if (kind === "cancelar_agora") events = await mockCancelNow(sub.provider_subscription_id);
  else {
    const { data: inv } = await db.from("payment_invoices").select("provider_invoice_id").eq("subscription_id", sub.id).eq("status", "paga").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!inv) return { error: "Nenhuma fatura paga para estornar ou contestar." };
    events = await mockRefundOrDispute(inv.provider_invoice_id, kind === "estorno" ? "estorno" : "contestacao");
  }
  const provider = getProvider();
  const results = [];
  for (const e of events) results.push(await handlePaymentEvent(e, provider));
  await db.from("audit_log").insert({ actor_id: admin.userId, tenant_id: sub.tenant_id, action: "payments.mock_event", entity: "payments", entity_id: sub.id, metadata: { kind } });
  revalidatePath("/admin/pagamentos");
  // A linha da assinatura pode sumir (ex.: cancelada) e levar o formulário junto: o resultado vai num aviso da página.
  redirect(`/admin/pagamentos?simulado=${kind}&resultado=${results.join(",")}`);
}

/**
 * Reembolso (Fase 10F, só modo de teste ou simulado): super admin com MFA
 * recente. A empresa sai da fatura no banco, nunca do formulário; o valor
 * pago, o saldo e o meio são conferidos de novo no provedor.
 */
export async function adminRefundAction(providerInvoiceId: string, _prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  if (!isPaymentsEnabled()) return { error: "Pagamentos indisponíveis." };
  const admin = await superAdmin();
  if (!admin) return { error: "Sem permissão." };
  const step = await checkRecentStepUp();
  if (!step.ok) return { error: STEP_UP_MESSAGES[step.reason] };
  if (String(formData.get("confirmacao") ?? "").trim().toUpperCase() !== "REEMBOLSAR") return { error: "Digite REEMBOLSAR para confirmar." };
  const amountCents = parseBrlToCents(String(formData.get("valor") ?? ""));
  const reasonRaw = String(formData.get("motivo") ?? "");
  const reason: RefundReason | null = reasonRaw === "pedido_do_cliente" || reasonRaw === "cobranca_duplicada" ? reasonRaw : null;
  if (!reason) return { error: "Escolha o motivo." };
  if (!Number.isFinite(amountCents)) return { error: "Valor inválido. Use, por exemplo, 49,90." };
  const { data: inv } = await createAdminClient().from("payment_invoices").select("tenant_id").eq("provider_invoice_id", providerInvoiceId).maybeSingle();
  if (!inv) return { error: "Fatura não encontrada." };
  const r = await requestRefund({ userId: admin.userId, tenantId: inv.tenant_id, providerInvoiceId, amountCents, reason });
  revalidatePath("/admin/pagamentos");
  if (!r.ok) return { error: r.error };
  return { ok: r.status === "succeeded" ? "Reembolso de teste feito." : `Reembolso pedido; situação na Stripe: ${r.status}.` };
}

/**
 * Origem de cobrança (Fase 10F, migration 0038). Registra que um serviço da
 * empresa é cobrado fora da plataforma (Omie ou outro meio): com isso, a
 * contratação pela Stripe do mesmo serviço é recusada. Super admin com MFA
 * recente. O banco garante uma só origem ativa por empresa e serviço.
 */
export async function adminRegisterBillingSourceAction(_prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  const admin = await superAdmin();
  if (!admin) return { error: "Sem permissão." };
  const step = await checkRecentStepUp();
  if (!step.ok) return { error: STEP_UP_MESSAGES[step.reason] };
  const tenantId = String(formData.get("empresa") ?? "");
  const serviceKey = String(formData.get("servico") ?? "");
  const source = String(formData.get("origem") ?? "");
  const note = String(formData.get("observacao") ?? "").trim().slice(0, 500) || null;
  if (!isValidServiceKey(serviceKey)) return { error: "Serviço inválido." };
  if (source !== "omie" && source !== "externo") return { error: "Escolha Omie ou outro meio. A Stripe é registrada sozinha, quando o pagamento é confirmado." };
  const db = createAdminClient();
  const { data: tenant } = await db.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant) return { error: "Empresa não encontrada." };
  const { error } = await db.from("billing_source_assignments").insert({ tenant_id: tenant.id, service_key: serviceKey, source, note, created_by: admin.userId });
  if (error?.code === "23505") return { error: "Já existe uma origem de cobrança ativa para este serviço desta empresa. Encerre a atual antes." };
  if (error) return { error: "Não foi possível registrar agora." };
  await db.from("audit_log").insert({ actor_id: admin.userId, tenant_id: tenant.id, action: "payments.billing_source_registered", entity: "payments", entity_id: tenant.id, metadata: { service_key: serviceKey, source } });
  revalidatePath("/admin/pagamentos");
  return { ok: "Origem de cobrança registrada." };
}

export async function adminEndBillingSourceAction(assignmentId: string, _prev: PaymentActionState | undefined, formData: FormData): Promise<PaymentActionState> {
  const admin = await superAdmin();
  if (!admin) return { error: "Sem permissão." };
  const step = await checkRecentStepUp();
  if (!step.ok) return { error: STEP_UP_MESSAGES[step.reason] };
  if (String(formData.get("confirmacao") ?? "").trim().toUpperCase() !== "ENCERRAR") return { error: "Digite ENCERRAR para confirmar." };
  const db = createAdminClient();
  const { data: row } = await db.from("billing_source_assignments").select("id, tenant_id, service_key, source, status").eq("id", assignmentId).maybeSingle();
  if (!row || row.status !== "ativa") return { error: "Origem não encontrada ou já encerrada." };
  if (row.source === "stripe") return { error: "A origem Stripe encerra sozinha quando a assinatura é cancelada." };
  const { error } = await db.from("billing_source_assignments").update({ status: "encerrada", ended_at: new Date().toISOString(), ended_by: admin.userId }).eq("id", row.id).eq("status", "ativa");
  if (error) return { error: "Não foi possível encerrar agora." };
  await db.from("audit_log").insert({ actor_id: admin.userId, tenant_id: row.tenant_id, action: "payments.billing_source_ended", entity: "payments", entity_id: row.id, metadata: { service_key: row.service_key, source: row.source } });
  revalidatePath("/admin/pagamentos");
  redirect("/admin/pagamentos?origem=encerrada");
}
