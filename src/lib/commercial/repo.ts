import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import type { SubscriptionSnapshot } from "@/lib/commercial/pricing";

/**
 * Dados comerciais (Fase 8). Leitura da empresa com a RLS do usuário; o
 * catálogo é lido pelo servidor (service role) porque o cliente não tem
 * acesso direto a ele no banco: a tela mostra só planos em rascunho, com aviso.
 */
export interface CatalogPlan {
  id: string;
  sku: string;
  product: "emissao" | "contabilidade";
  name: string;
  description: string;
  monthlyCents: number | null;
  quota: number | null;
  overageCents: number | null;
  status: "draft" | "approved" | "archived";
  version: number;
  updatedAt: string;
  approvedAt: string | null;
  approvalReference: string | null;
  effectiveFrom: string | null;
}

/**
 * Catálogo. `approved` (padrão) é o que cliente, landing e assistente veem:
 * só planos com preço aprovado. O Admin usa `all` (rascunhos e arquivados).
 */
export async function listCatalog(scope: "approved" | "all" = "approved"): Promise<CatalogPlan[]> {
  const admin = createAdminClient();
  let q = admin.from("commercial_plans").select("*").order("monthly_cents", { ascending: true, nullsFirst: false });
  if (scope === "approved") q = q.eq("status", "approved");
  const { data } = await q;
  return (data ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    product: p.product as CatalogPlan["product"],
    name: p.name,
    description: p.description,
    monthlyCents: p.monthly_cents,
    quota: p.quota,
    overageCents: p.overage_cents,
    status: p.status as CatalogPlan["status"],
    version: p.version,
    updatedAt: p.updated_at,
    approvedAt: p.approved_at,
    approvalReference: p.approval_reference,
    effectiveFrom: p.effective_from,
  }));
}

/** Versões anteriores de cada plano (vigência e preço), mais recentes primeiro. */
export async function getPlanHistory(limit = 200) {
  const { data } = await createAdminClient()
    .from("commercial_plan_changes")
    .select("plan_id, after, changed_at")
    .order("changed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => {
    const a = (c.after ?? {}) as Record<string, unknown>;
    return {
      planId: c.plan_id,
      changedAt: c.changed_at,
      version: Number(a.version ?? 0),
      status: String(a.status ?? ""),
      monthlyCents: (a.monthly_cents as number | null) ?? null,
      quota: (a.quota as number | null) ?? null,
      overageCents: (a.overage_cents as number | null) ?? null,
      effectiveFrom: (a.effective_from as string | null) ?? null,
    };
  });
}

/** Histórico das configurações comerciais (desconto do combo etc.). */
export async function getSettingHistory(key: string, limit = 20) {
  const { data } = await createAdminClient()
    .from("commercial_setting_changes")
    .select("before, after, changed_at")
    .eq("key", key)
    .order("changed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({ before: c.before, after: c.after, changedAt: c.changed_at }));
}

/** Versão pública e mínima do catálogo aprovado (landing e assistente). */
export interface PublicPlan {
  sku: string;
  name: string;
  description: string;
  monthlyCents: number | null;
  quota: number | null;
  overageCents: number | null;
}
export async function getPublicEmissionCatalog(): Promise<{ plans: PublicPlan[]; comboDiscountBp: number }> {
  const [plans, combo] = await Promise.all([listCatalog("approved"), getComboDiscountBp()]);
  return {
    plans: plans
      .filter((p) => p.product === "emissao")
      .map((p) => ({ sku: p.sku, name: p.name, description: p.description, monthlyCents: p.monthlyCents, quota: p.quota, overageCents: p.overageCents })),
    comboDiscountBp: combo,
  };
}

export async function getComboDiscountBp(): Promise<number> {
  const { data } = await createAdminClient()
    .from("commercial_settings")
    .select("value")
    .eq("key", "combo_discount_bp")
    .maybeSingle();
  const v = Number(data?.value);
  return Number.isFinite(v) ? v : 0;
}

export interface TenantCommercial {
  relationship: "contabilidade" | "somente_emissao" | null;
  subscription:
    | (SubscriptionSnapshot & {
        id: string;
        planId: string;
        planName: string | null;
        cycleStart: string;
        cycleEnd: string;
        pendingPlanId: string | null;
        createdAt: string;
      })
    | null;
  usedSimulated: number;
  usedBillable: number;
  acceptances: { document: string; version: string; acceptedAt: string }[];
}

/** Situação comercial da empresa ativa (RLS do usuário + empresa explícita). */
export async function getTenantCommercial(tenantId: string): Promise<TenantCommercial> {
  const supabase = await createClient();
  const [{ data: account }, { data: sub }] = await Promise.all([
    supabase.from("commercial_accounts").select("relationship").eq("tenant_id", tenantId).maybeSingle(),
    supabase
      .from("commercial_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelada")
      .maybeSingle(),
  ]);
  let usedSimulated = 0;
  let usedBillable = 0;
  let acceptances: TenantCommercial["acceptances"] = [];
  let planName: string | null = null;
  if (sub) {
    const [{ data: usage }, { data: acc }, { data: plan }] = await Promise.all([
      supabase.from("commercial_usage_ledger").select("kind, billable").eq("tenant_id", tenantId).eq("cycle_start", sub.cycle_start),
      supabase.from("commercial_acceptances").select("document, document_version, accepted_at").eq("subscription_id", sub.id).order("accepted_at"),
      createAdminClient().from("commercial_plans").select("name").eq("id", sub.plan_id).maybeSingle(),
    ]);
    usedSimulated = (usage ?? []).filter((u) => u.kind === "simulada").length;
    usedBillable = (usage ?? []).filter((u) => u.billable).length;
    acceptances = (acc ?? []).map((a) => ({ document: a.document, version: a.document_version, acceptedAt: a.accepted_at }));
    planName = plan?.name ?? null;
  }
  return {
    relationship: (account?.relationship as TenantCommercial["relationship"]) ?? null,
    subscription: sub
      ? {
          id: sub.id,
          planId: sub.plan_id,
          planName,
          sku: sub.plan_sku,
          monthlyCents: sub.monthly_cents,
          quota: sub.quota,
          overageCents: sub.overage_cents,
          discountBp: sub.discount_bp,
          status: sub.status as SubscriptionSnapshot["status"],
          overageAuthorized: sub.overage_authorized,
          spendingLimitCents: sub.spending_limit_cents,
          cycleStart: sub.cycle_start,
          cycleEnd: sub.cycle_end,
          pendingPlanId: sub.pending_plan_id,
          createdAt: sub.created_at,
        }
      : null,
    usedSimulated,
    usedBillable,
    acceptances,
  };
}

/** Direito de uso calculado pelo BANCO (função has_entitlement), nunca pela tela. */
export async function hasEntitlement(tenantId: string, feature: "nfse" | "contabilidade"): Promise<boolean> {
  const { data } = await createAdminClient().rpc("has_entitlement", { p_tenant_id: tenantId, p_feature: feature });
  return data === true;
}

/** Visão do Admin: assinaturas e consumo do ciclo por empresa. */
export async function listSubscriptionsForAdmin() {
  const supabase = await createClient();
  const [{ data: subs }, { data: tenants }, { data: accounts }, { data: usage }] = await Promise.all([
    supabase.from("commercial_subscriptions").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("tenants").select("id, name").order("name"),
    supabase.from("commercial_accounts").select("tenant_id, relationship"),
    supabase.from("commercial_usage_ledger").select("tenant_id, cycle_start, kind").limit(5000),
  ]);
  const name = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  const rel = new Map((accounts ?? []).map((a) => [a.tenant_id, a.relationship]));
  return {
    tenants: (tenants ?? []).map((t) => ({ ...t, relationship: rel.get(t.id) ?? null })),
    subscriptions: (subs ?? []).map((s) => ({
      id: s.id,
      tenantId: s.tenant_id,
      tenantName: name.get(s.tenant_id) ?? "—",
      sku: s.plan_sku,
      status: s.status,
      discountBp: s.discount_bp,
      quota: s.quota,
      monthlyCents: s.monthly_cents,
      cycleStart: s.cycle_start,
      cycleEnd: s.cycle_end,
      overageAuthorized: s.overage_authorized,
      used: (usage ?? []).filter((u) => u.tenant_id === s.tenant_id && u.cycle_start === s.cycle_start).length,
    })),
  };
}

export async function getCostPremises(): Promise<{ costPerNoteCents: number | null; fixedCostPerClientCents: number | null }> {
  const { data } = await createAdminClient().from("commercial_settings").select("value").eq("key", "cost_premises").maybeSingle();
  const v = (data?.value ?? {}) as { costPerNoteCents?: number | null; fixedCostPerClientCents?: number | null };
  return { costPerNoteCents: v.costPerNoteCents ?? null, fixedCostPerClientCents: v.fixedCostPerClientCents ?? null };
}
