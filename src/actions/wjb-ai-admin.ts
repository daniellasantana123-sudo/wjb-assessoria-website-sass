"use server";

import { revalidatePath } from "next/cache";

import { requireStaffSession, type Session } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import { toIsoDate } from "@/lib/reports/period";
import { getFiscalProviderMode, isWjbAiEnabled } from "@/lib/wjb-ai/config";
import type { TransitionStep } from "@/lib/wjb-ai/fiscal/requests";
import { checkSendReadiness, planReview, type ReviewDecision } from "@/lib/wjb-ai/fiscal/review";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";
import { hasWjbAiPermission, type WjbAiPermission } from "@/lib/wjb-ai/permissions";

export interface AdminActionState {
  error?: string;
  ok?: string;
}

async function guard(permission: WjbAiPermission | "super_admin"): Promise<Session | AdminActionState> {
  if (!isWjbAiEnabled()) return { error: "Recurso indisponível." };
  const session = await requireStaffSession();
  const allowed = permission === "super_admin" ? session.staffRole === "super_admin" : hasWjbAiPermission(session, permission);
  return allowed ? session : { error: "Você não tem permissão para esta ação." };
}
const isState = (v: Session | AdminActionState): v is AdminActionState => "error" in v;

async function audit(session: Session, tenantId: string | null, action: string, entity: string, entityId: string, metadata: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({ actor_id: session.userId, tenant_id: tenantId, action, entity, entity_id: entityId, metadata });
}

/** Aplica passos de estado: atualização com a RLS da equipe + evento gravado pelo servidor. */
async function applySteps(session: Session, requestId: string, tenantId: string, steps: TransitionStep[]): Promise<boolean> {
  const supabase = await createClient();
  const admin = createAdminClient();
  for (const s of steps) {
    const { data } = await supabase
      .from("fiscal_requests")
      .update({ status: s.to, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", s.from)
      .select("id");
    if (!data?.length) return false;
    await admin.from("fiscal_request_events").insert({
      request_id: requestId, tenant_id: tenantId, from_status: s.from, to_status: s.to,
      actor_id: session.userId, actor_kind: "user", reason: s.reason,
    });
  }
  return true;
}

async function loadRequest(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("fiscal_requests").select("id, tenant_id, status, needs_intervention").eq("id", requestId).maybeSingle();
  return data;
}

export async function reviewRequestAction(requestId: string, _prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("fiscal.review");
  if (isState(session)) return session;
  const request = await loadRequest(requestId);
  if (!request) return { error: "Pedido não encontrado." };
  const decision = String(formData.get("decision")) as ReviewDecision;
  if (!["approve", "request_data", "block"].includes(decision)) return { error: "Decisão inválida." };
  const plan = planReview(request.status as FiscalStatus, decision, String(formData.get("note") ?? ""));
  if (!plan.ok) return { error: plan.error };
  if (!(await applySteps(session, requestId, request.tenant_id, plan.steps))) {
    return { error: "O pedido mudou enquanto você revisava. Recarregue a página." };
  }
  await audit(session, request.tenant_id, "fiscal.request_reviewed", "fiscal_request", requestId, { decision, to: plan.steps.at(-1)!.to });
  revalidatePath(`/admin/nfse/${requestId}`);
  return { ok: "Decisão registrada." };
}

export async function authorizeSendAction(requestId: string, _prev: AdminActionState | undefined): Promise<AdminActionState> {
  void _prev;
  const session = await guard("fiscal.review");
  if (isState(session)) return session;
  const request = await loadRequest(requestId);
  if (!request) return { error: "Pedido não encontrado." };
  const supabase = await createClient();
  const [{ data: profile }, { data: grant }] = await Promise.all([
    supabase.from("fiscal_profiles").select("id").eq("tenant_id", request.tenant_id).eq("status", "approved").maybeSingle(),
    supabase.from("fiscal_authorization_grants").select("valid_until").eq("tenant_id", request.tenant_id).eq("status", "active").order("valid_until", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ready = checkSendReadiness({
    status: request.status as FiscalStatus, hasApprovedProfile: !!profile, grantValidUntil: grant?.valid_until ?? null,
    providerMode: getFiscalProviderMode(), today: toIsoDate(new Date()),
  });
  if (!ready.ok) return { error: ready.reasons.join(" ") };
  const ok = await applySteps(session, requestId, request.tenant_id, [
    { from: "CONFIRMADA", to: "AUTORIZADA_PARA_ENVIO", reason: "Envio autorizado pelo contador (conector SIMULADO)." },
  ]);
  if (!ok) return { error: "O pedido mudou. Recarregue a página." };
  await audit(session, request.tenant_id, "fiscal.request_authorized_for_send", "fiscal_request", requestId, { mode: "mock" });
  revalidatePath(`/admin/nfse/${requestId}`);
  return { ok: "Pedido na fila de envio simulado." };
}

export async function releaseInterventionAction(requestId: string, _prev: AdminActionState | undefined): Promise<AdminActionState> {
  void _prev;
  const session = await guard("fiscal.review");
  if (isState(session)) return session;
  const request = await loadRequest(requestId);
  if (!request?.needs_intervention) return { error: "Este pedido não está na fila de erros." };
  const admin = createAdminClient();
  await admin.from("fiscal_requests").update({ needs_intervention: false, attempt_count: 0, next_attempt_at: new Date().toISOString(), last_error: null }).eq("id", requestId);
  await admin.from("fiscal_request_events").insert({
    request_id: requestId, tenant_id: request.tenant_id, from_status: null, to_status: request.status,
    actor_id: session.userId, actor_kind: "user", reason: "Reprocessamento liberado pela equipe (nova conciliação antes de qualquer reenvio).",
  });
  await audit(session, request.tenant_id, "fiscal.intervention_released", "fiscal_request", requestId, {});
  revalidatePath(`/admin/nfse/${requestId}`);
  return { ok: "Pedido devolvido à fila." };
}

export async function createProfileDraftAction(tenantId: string, _prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("fiscal.profile.manage");
  if (isState(session)) return session;
  const reais = String(formData.get("maxAmount") ?? "").replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(reais)) return { error: "Informe o limite por nota, por exemplo 1.000,00." };
  const ibge = String(formData.get("municipality") ?? "").trim();
  if (ibge && !/^\d{7}$/.test(ibge)) return { error: "O código IBGE do município tem 7 dígitos." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("fiscal_profiles").select("version").eq("tenant_id", tenantId).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const { data, error } = await supabase.from("fiscal_profiles").insert({
    tenant_id: tenantId, version, municipality_ibge_code: ibge || null,
    max_amount_cents_without_review: Math.round(Number(reais) * 100), created_by: session.userId,
  }).select("id").single();
  if (error || !data) return { error: "Não foi possível criar o rascunho." };
  await audit(session, tenantId, "fiscal.profile_created", "fiscal_profile", data.id, { version });
  revalidatePath("/admin/nfse/perfis");
  return { ok: `Rascunho versão ${version} criado.` };
}

export async function approveProfileAction(profileId: string, _prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("fiscal.review");
  if (isState(session)) return session;
  const supabase = await createClient();
  // A checagem decisiva é do banco: só contador com fiscal_profile.approve para a empresa.
  const { error } = await supabase.rpc("approve_fiscal_profile", {
    p_fiscal_profile_id: profileId, p_justification: String(formData.get("justification") ?? ""),
  });
  if (error) {
    return { error: error.code === "42501" ? "Você não tem a permissão fiscal_profile.approve para esta empresa." : error.message };
  }
  revalidatePath("/admin/nfse/perfis");
  return { ok: "Perfil aprovado." };
}

export async function registerAuthorizationAction(tenantId: string, _prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("fiscal.profile.manage");
  if (isState(session)) return session;
  const kind = String(formData.get("kind"));
  if (!["procuracao", "certificado_proprio", "consentimento_assistido"].includes(kind)) return { error: "Tipo inválido." };
  const scope = String(formData.get("scope") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "");
  const evidence = String(formData.get("evidence") ?? "").trim();
  if (scope.length < 5) return { error: "Descreva o escopo da autorização." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { error: "Informe a validade." };
  if (!evidence) return { error: "Informe onde está guardada a evidência (nunca o arquivo ou a senha)." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("fiscal_authorization_grants").insert({
    tenant_id: tenantId, kind, scope, valid_until: validUntil, evidence_reference: evidence, registered_by: session.userId,
  }).select("id").single();
  if (error || !data) return { error: "Não foi possível registrar." };
  await audit(session, tenantId, "fiscal.authorization_registered", "fiscal_authorization_grant", data.id, { kind, valid_until: validUntil });
  revalidatePath("/admin/nfse/perfis");
  return { ok: "Autorização registrada." };
}

export async function grantApproverAction(_prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("super_admin");
  if (isState(session)) return session;
  const supabase = await createClient();
  const tenant = String(formData.get("tenantId") ?? "");
  const { error } = await supabase.rpc("grant_fiscal_profile_approver", {
    p_profile_id: String(formData.get("profileId") ?? ""), p_tenant_id: tenant || null, p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: error.code === "23514" ? "Explique o motivo (mínimo de 10 caracteres)." : error.message };
  revalidatePath("/admin/nfse/permissoes");
  return { ok: "Permissão concedida." };
}

export async function revokeApproverAction(grantId: string, _prev: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  const session = await guard("super_admin");
  if (isState(session)) return session;
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Informe o motivo da revogação." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_fiscal_profile_approver", { p_grant_id: grantId, p_reason: reason });
  if (error) return { error: error.message };
  revalidatePath("/admin/nfse/permissoes");
  return { ok: "Permissão revogada." };
}
