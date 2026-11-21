"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession, requireStaffSession, type Session } from "@/lib/auth/dal";
import { isCommercialEnabled } from "@/lib/commercial/config";
import {
  ACCEPTANCE_DOCUMENTS,
  comboDiscountBp,
  cycleFor,
  MAX_COMBO_DISCOUNT_BP,
  type AcceptanceDocument,
} from "@/lib/commercial/pricing";
import { getComboDiscountBp, getTenantCommercial } from "@/lib/commercial/repo";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import { toIsoDate } from "@/lib/reports/period";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";

export interface CommercialState {
  error?: string;
  ok?: string;
}

/**
 * Contratação SIMULADA (Fase 8). Regras no servidor:
 * - empresa só da sessão; só o responsável (owner) contrata, troca ou cancela;
 * - preço, franquia e desconto vêm do catálogo e da configuração no servidor
 *   (o formulário manda só o código do plano);
 * - aceites gravados um a um, com versão do documento;
 * - nenhuma cobrança: o banco só aceita assinatura em modo 'simulado'.
 */
async function ownerContext(): Promise<{ session: Session; tenantId: string } | CommercialState> {
  if (!isCommercialEnabled()) return { error: "Recurso indisponível." };
  const session = await requireSession();
  if (session.isWjbStaff) return { error: "A contratação é feita pela conta do cliente." };
  if (isRateLimited(`commercial:${session.userId}`, 10)) return { error: "Muitas tentativas. Aguarde um minuto." };
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) return { error: "Nenhuma empresa vinculada à sua conta." };
  if (tenant.role !== "owner") return { error: "Só o responsável pela empresa pode contratar ou alterar o plano." };
  return { session, tenantId: tenant.id };
}
const isErr = (v: unknown): v is CommercialState => typeof v === "object" && v !== null && "error" in v;

async function audit(actor: string, tenantId: string | null, action: string, entityId: string, metadata: Record<string, unknown>) {
  await createAdminClient().from("audit_log").insert({ actor_id: actor, tenant_id: tenantId, action, entity: "commercial", entity_id: entityId, metadata });
}

export async function contractPlanAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const ctx = await ownerContext();
  if (isErr(ctx)) return ctx;
  const sku = String(formData.get("sku") ?? "");
  const missing = (Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).filter((d) => formData.get(`aceite_${d}`) !== "on");
  if (missing.length) return { error: "Para contratar, marque todos os aceites (cada um é registrado separadamente)." };

  const admin = createAdminClient();
  const { data: plan } = await admin.from("commercial_plans").select("*").eq("sku", sku).eq("status", "draft").eq("product", "emissao").maybeSingle();
  if (!plan) return { error: "Plano não encontrado." };
  if (plan.monthly_cents === null && plan.overage_cents === null) return { error: "Este plano é sob proposta: fale com a equipe comercial." };

  const current = await getTenantCommercial(ctx.tenantId);
  if (current.subscription) return { error: "A empresa já tem um plano. Use a troca de plano." };
  const isAccounting = current.relationship === "contabilidade";
  const discount = comboDiscountBp(isAccounting, await getComboDiscountBp());
  const { start, end } = cycleFor(toIsoDate(new Date()));

  // Conta comercial única por empresa: cliente sem relação vira "somente emissão".
  if (!current.relationship) await admin.from("commercial_accounts").insert({ tenant_id: ctx.tenantId, relationship: "somente_emissao" });

  const { data: sub, error } = await admin
    .from("commercial_subscriptions")
    .insert({
      tenant_id: ctx.tenantId,
      plan_id: plan.id,
      plan_sku: plan.sku,
      monthly_cents: plan.monthly_cents,
      quota: plan.quota,
      overage_cents: plan.overage_cents,
      discount_bp: discount,
      cycle_start: start,
      cycle_end: end,
      created_by: ctx.session.userId,
    })
    .select("id")
    .single();
  if (error || !sub) return { error: error?.code === "23505" ? "A empresa já tem um plano." : "Não foi possível registrar a contratação." };
  await admin.from("commercial_acceptances").insert(
    (Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).map((d) => ({
      tenant_id: ctx.tenantId,
      subscription_id: sub.id,
      user_id: ctx.session.userId,
      document: d,
      document_version: ACCEPTANCE_DOCUMENTS[d].version,
    })),
  );
  await audit(ctx.session.userId, ctx.tenantId, "commercial.subscription_created", sub.id, { sku: plan.sku, discount_bp: discount, simulated: true });
  revalidatePath("/portal/plano");
  // O formulário some (a página passa a mostrar o plano ativo): a confirmação vai num aviso fixo.
  redirect("/portal/plano?contratado=1");
}

export async function overageSettingsAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const ctx = await ownerContext();
  if (isErr(ctx)) return ctx;
  const authorized = formData.get("authorized") === "on";
  const raw = String(formData.get("limit") ?? "").replace(/\./g, "").replace(",", ".").trim();
  const limit = raw ? Math.round(Number(raw) * 100) : null;
  if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 10_000_000)) return { error: "Limite de gasto inválido." };
  const current = await getTenantCommercial(ctx.tenantId);
  if (!current.subscription) return { error: "A empresa não tem plano." };
  await createAdminClient()
    .from("commercial_subscriptions")
    .update({ overage_authorized: authorized, spending_limit_cents: limit })
    .eq("id", current.subscription.id);
  await audit(ctx.session.userId, ctx.tenantId, "commercial.overage_settings", current.subscription.id, { authorized, limit_cents: limit });
  revalidatePath("/portal/plano");
  return { ok: authorized ? "Excedente autorizado dentro do limite informado (simulação)." : "Excedente desautorizado: ao atingir a franquia, novos pedidos param até você autorizar." };
}

export async function schedulePlanChangeAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const ctx = await ownerContext();
  if (isErr(ctx)) return ctx;
  const sku = String(formData.get("sku") ?? "");
  const admin = createAdminClient();
  const { data: plan } = await admin.from("commercial_plans").select("id, name").eq("sku", sku).eq("status", "draft").eq("product", "emissao").maybeSingle();
  if (!plan) return { error: "Plano não encontrado." };
  const current = await getTenantCommercial(ctx.tenantId);
  if (!current.subscription) return { error: "A empresa não tem plano." };
  if (current.subscription.planId === plan.id) return { error: "Esse já é o plano atual." };
  await admin.from("commercial_subscriptions").update({ pending_plan_id: plan.id }).eq("id", current.subscription.id);
  await audit(ctx.session.userId, ctx.tenantId, "commercial.plan_change_scheduled", current.subscription.id, { to_sku: sku });
  revalidatePath("/portal/plano");
  return { ok: `Troca para ${plan.name} agendada para o próximo ciclo (sem pro rata nesta simulação).` };
}

export async function cancelSubscriptionAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const ctx = await ownerContext();
  if (isErr(ctx)) return ctx;
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Conte o motivo do cancelamento." };
  if (formData.get("confirm") !== "on") return { error: "Confirme que entendeu o efeito do cancelamento." };
  const current = await getTenantCommercial(ctx.tenantId);
  if (!current.subscription) return { error: "A empresa não tem plano." };
  await createAdminClient()
    .from("commercial_subscriptions")
    .update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: reason.slice(0, 300) })
    .eq("id", current.subscription.id);
  await audit(ctx.session.userId, ctx.tenantId, "commercial.subscription_canceled", current.subscription.id, {});
  revalidatePath("/portal/plano");
  redirect("/portal/plano?cancelado=1");
}

// ---------------- Admin ----------------
async function superAdmin(): Promise<Session | CommercialState> {
  if (!isCommercialEnabled()) return { error: "Recurso indisponível." };
  const session = await requireStaffSession();
  return session.staffRole === "super_admin" ? session : { error: "Só super admin altera catálogo, preços e descontos." };
}

const cents = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim();
  if (!s) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export async function savePlanAction(planId: string | null, _prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const session = await superAdmin();
  if (isErr(session)) return session;
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const monthly = cents(formData.get("monthly"));
  const overage = cents(formData.get("overage"));
  const quotaRaw = String(formData.get("quota") ?? "").trim();
  const quota = quotaRaw ? Number.parseInt(quotaRaw, 10) : null;
  const status = String(formData.get("status") ?? "draft");
  if (name.length < 2) return { error: "Informe o nome do plano." };
  if (!planId && !/^[a-z0-9_]{3,40}$/.test(sku)) return { error: "Código (sku) com letras minúsculas, números e _." };
  if (Number.isNaN(monthly) || Number.isNaN(overage) || (quota !== null && (!Number.isInteger(quota) || quota < 0)))
    return { error: "Valores inválidos." };
  if (status !== "draft" && status !== "archived") return { error: "Nesta fase o plano só pode ser rascunho ou arquivado." };
  const supabase = await createClient(); // RLS: só super_admin escreve; o banco versiona e guarda histórico
  const row = { name, description: String(formData.get("description") ?? "").slice(0, 500), monthly_cents: monthly, quota, overage_cents: overage, status };
  const { error } = planId
    ? await supabase.from("commercial_plans").update(row).eq("id", planId)
    : await supabase.from("commercial_plans").insert({ ...row, sku, product: "emissao" });
  if (error) return { error: error.code === "23505" ? "Já existe plano com esse código." : "Não foi possível salvar." };
  await audit(session.userId, null, planId ? "commercial.plan_updated" : "commercial.plan_created", planId ?? sku, { status });
  revalidatePath("/admin/comercial");
  return { ok: "Plano salvo como rascunho (versão e histórico registrados)." };
}

export async function saveComboDiscountAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const session = await superAdmin();
  if (isErr(session)) return session;
  const pct = Number(String(formData.get("percent") ?? "").replace(",", "."));
  if (!Number.isFinite(pct) || pct < 0 || pct * 100 > MAX_COMBO_DISCOUNT_BP) return { error: `Desconto entre 0% e ${MAX_COMBO_DISCOUNT_BP / 100}%.` };
  const supabase = await createClient();
  const { error } = await supabase.from("commercial_settings").upsert({ key: "combo_discount_bp", value: Math.round(pct * 100), updated_by: session.userId });
  if (error) return { error: "Não foi possível salvar." };
  await audit(session.userId, null, "commercial.combo_discount_updated", "combo_discount_bp", { percent: pct });
  revalidatePath("/admin/comercial");
  return { ok: `Desconto do combo: ${pct}% só sobre a mensalidade de emissão (novas contratações).` };
}

export async function setRelationshipAction(tenantId: string, _prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const session = await superAdmin();
  if (isErr(session)) return session;
  const relationship = String(formData.get("relationship") ?? "");
  if (relationship !== "contabilidade" && relationship !== "somente_emissao") return { error: "Relação inválida." };
  const { error } = await createAdminClient().from("commercial_accounts").upsert({ tenant_id: tenantId, relationship });
  if (error) return { error: "Não foi possível salvar." };
  await audit(session.userId, tenantId, "commercial.relationship_set", tenantId, { relationship });
  revalidatePath("/admin/comercial");
  return { ok: "Relação comercial atualizada." };
}

export async function adminSubscriptionStatusAction(subscriptionId: string, _prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const session = await superAdmin();
  if (isErr(session)) return session;
  const status = String(formData.get("status") ?? "");
  if (status !== "ativa_simulada" && status !== "suspensa") return { error: "Status inválido." };
  const { data, error } = await createAdminClient()
    .from("commercial_subscriptions")
    .update({ status })
    .eq("id", subscriptionId)
    .neq("status", "cancelada")
    .select("tenant_id")
    .maybeSingle();
  if (error || !data) return { error: "Assinatura não encontrada ou cancelada." };
  await audit(session.userId, data.tenant_id, "commercial.subscription_status", subscriptionId, { status });
  revalidatePath("/admin/comercial");
  return { ok: status === "suspensa" ? "Assinatura suspensa: novos pedidos param, histórico mantido." : "Assinatura reativada." };
}

export async function saveCostPremisesAction(_prev: CommercialState | undefined, formData: FormData): Promise<CommercialState> {
  const session = await superAdmin();
  if (isErr(session)) return session;
  const perNote = cents(formData.get("costPerNote"));
  const fixed = cents(formData.get("fixedPerClient"));
  if (Number.isNaN(perNote) || Number.isNaN(fixed)) return { error: "Valores inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("commercial_settings").upsert({ key: "cost_premises", value: { costPerNoteCents: perNote, fixedCostPerClientCents: fixed }, updated_by: session.userId });
  if (error) return { error: "Não foi possível salvar." };
  await audit(session.userId, null, "commercial.cost_premises_updated", "cost_premises", {});
  revalidatePath("/admin/comercial");
  return { ok: "Premissas de custo salvas." };
}
