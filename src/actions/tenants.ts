"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { requireStaffSession, requireTenantAccess, getTenantRole } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import type { TenantMemberRole } from "@/types/database";
import {
  createTenantSchema,
  inviteMemberSchema,
  type CreateTenantValues,
  type InviteMemberValues,
} from "@/lib/validation/tenant";

export type TenantActionState = { error: string } | { success: string } | undefined;

/** Admin WJB > Empresas (SAAS FASE 4) — só staff cria empresa cliente. */
export async function createTenant(
  _prevState: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const session = await requireStaffSession();

  const raw: CreateTenantValues = {
    name: String(formData.get("name") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
  };

  const validated = createTenantSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      name: validated.data.name,
      cnpj: validated.data.cnpj || null,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error || !tenant) {
    console.error("[tenants] falha ao criar empresa:", error);
    return { error: "Não foi possível criar a empresa." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenant.id,
    action: "tenant.created",
    entity: "tenant",
    entity_id: tenant.id,
    metadata: { name: tenant.name },
  });

  revalidatePath("/admin/empresas");
  redirect(`/admin/empresas/${tenant.id}`);
}

/**
 * Editar nome/CNPJ de uma empresa já cadastrada (Fase 5 do wjb-saas-mvp,
 * 2026-09-20 - Console Admin WJB). `organizations.manage` já existia desde
 * a Fase 1 (`src/lib/permissions/permissions.ts`) mas nunca tinha um ponto
 * de checagem real - esta é a primeira ação a usá-la de verdade, mesmo
 * padrão de `documents.delete` na Fase 3.
 */
export async function updateTenant(
  tenantId: string,
  _prevState: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "organizations.manage")) {
    return { error: "Você não tem permissão para editar empresas." };
  }

  const raw: CreateTenantValues = {
    name: String(formData.get("name") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
  };

  const validated = createTenantSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ name: validated.data.name, cnpj: validated.data.cnpj || null })
    .eq("id", tenantId);

  if (error) {
    console.error("[tenants] falha ao editar empresa:", error);
    return { error: "Não foi possível salvar as alterações." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant.updated",
    entity: "tenant",
    entity_id: tenantId,
    metadata: { name: validated.data.name, cnpj: validated.data.cnpj || null },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  revalidatePath("/admin/empresas");
  return { success: "Empresa atualizada." };
}

/**
 * Suspender a EMPRESA inteira (Fase 5) - mais severo que `suspendMember`
 * (uma pessoa) ou `suspendAccount` (uma conta): corta o acesso de TODOS
 * os membros de uma vez, via `tenants.status` (migration 0018), que
 * `my_tenant_ids()` agora respeita na RLS de toda tabela dependente
 * (documents, obligations, tickets, messages, notifications,
 * omie_client_mappings) - não é só um efeito de UI. Exclusivo de
 * super_admin (`tenants.suspend`), mesmo nível de severidade de
 * `suspendAccount`/`reactivateAccount` em `src/actions/staff.ts`.
 */
export async function suspendTenant(tenantId: string) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "tenants.suspend")) return;

  const supabase = await createClient();
  await supabase.from("tenants").update({ status: "suspended" }).eq("id", tenantId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant.suspended",
    entity: "tenant",
    entity_id: tenantId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  revalidatePath("/admin/empresas");
}

export async function reactivateTenant(tenantId: string) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "tenants.suspend")) return;

  const supabase = await createClient();
  await supabase.from("tenants").update({ status: "active" }).eq("id", tenantId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant.reactivated",
    entity: "tenant",
    entity_id: tenantId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  revalidatePath("/admin/empresas");
}

/**
 * Convida uma pessoa para o Portal do Cliente de uma empresa. Staff convida
 * pra qualquer empresa; o responsável (owner) da própria empresa também
 * pode convidar colegas, sem precisar pedir pra WJB (RLS de
 * `tenant_members` — 0006_tenant_owner_can_invite.sql). Se o e-mail já tem
 * conta (já é membro de outra empresa, por exemplo), só vincula — não
 * manda convite duplicado. Se não existe, cria a conta via Supabase Auth
 * (e-mail de convite nativo do Supabase — não depende da integração de
 * e-mail transacional da SAAS FASE 5, que é para outro tipo de mensagem).
 */
export async function inviteMember(
  tenantId: string,
  _prevState: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const session = await requireTenantAccess(tenantId);
  const role = await getTenantRole(tenantId);
  if (role !== "owner") {
    return { error: "Só o responsável pela empresa pode convidar novas pessoas." };
  }

  const raw: InviteMemberValues = {
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: formData.get("role") === "owner" ? "owner" : "member",
  };

  const validated = inviteMemberSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", validated.data.email)
    .maybeSingle();

  let profileId = existingProfile?.id;

  if (!profileId) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      validated.data.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: { full_name: validated.data.fullName },
      },
    );

    if (inviteError || !invited.user) {
      console.error("[tenants] falha ao convidar usuário:", inviteError);
      return { error: "Não foi possível convidar esse e-mail." };
    }

    profileId = invited.user.id;
  }

  const { error: memberError } = await supabase.from("tenant_members").insert({
    tenant_id: tenantId,
    profile_id: profileId,
    role: validated.data.role,
  });

  if (memberError) {
    if (memberError.code !== "23505") {
      console.error("[tenants] falha ao adicionar membro:", memberError);
    }
    return {
      error:
        memberError.code === "23505"
          ? "Essa pessoa já faz parte desta empresa."
          : "Não foi possível adicionar o membro.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.invited",
    entity: "tenant_member",
    entity_id: profileId,
    metadata: { email: validated.data.email, role: validated.data.role },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  return { success: "Convite enviado." };
}

/**
 * Suspende o vínculo de uma pessoa com UMA empresa específica (Fase 2 do
 * wjb-saas-mvp, 2026-09-20) — diferente de suspender a conta inteira
 * (`src/actions/staff.ts::suspendAccount`): a pessoa continua podendo
 * logar e acessar outras empresas de que seja membro, só perde acesso a
 * esta. Exclusivo de staff, mesmo nível de `tenant_members_update_staff_only`
 * (0006_tenant_owner_can_invite.sql) — mais sensível que convidar, por isso
 * não é liberado pro `owner` da própria empresa.
 */
export async function suspendMember(tenantId: string, profileId: string) {
  const session = await requireStaffSession();

  const supabase = await createClient();
  await supabase
    .from("tenant_members")
    .update({ status: "suspended" })
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.suspended",
    entity: "tenant_member",
    entity_id: profileId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}

export async function reactivateMember(tenantId: string, profileId: string) {
  const session = await requireStaffSession();

  const supabase = await createClient();
  await supabase
    .from("tenant_members")
    .update({ status: "active" })
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.reactivated",
    entity: "tenant_member",
    entity_id: profileId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}

/**
 * Trocar o papel (owner/member) de alguém dentro de uma empresa (Fase 5).
 * `members.manage` existia desde a Fase 1 sem nenhum ponto de checagem
 * real - esta é a primeira ação a usá-la. Staff-only, mesmo nível de
 * `suspendMember` (mais sensível que convidar, que o próprio `owner` já
 * pode fazer sozinho).
 */
export async function updateMemberRole(
  tenantId: string,
  profileId: string,
  role: TenantMemberRole,
) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "members.manage")) return;

  const supabase = await createClient();
  await supabase
    .from("tenant_members")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.role_changed",
    entity: "tenant_member",
    entity_id: profileId,
    metadata: { role },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}

/**
 * Revoga o acesso de alguém a uma empresa (Fase 5) - diferente de
 * `suspendMember`: aqui o vínculo é apagado de vez, não só marcado como
 * suspenso. Staff-only (`members.manage`).
 */
export async function revokeMemberAccess(tenantId: string, profileId: string) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "members.manage")) return;

  const supabase = await createClient();
  await supabase
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.access_revoked",
    entity: "tenant_member",
    entity_id: profileId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}

/**
 * Reenvia o convite de um membro pendente (Fase 5) - mesma regra de acesso
 * de `inviteMember` (staff ou o `owner` da própria empresa, via
 * `getTenantRole` - retorna "owner" pra staff também). Reaproveita
 * `admin.auth.admin.inviteUserByEmail`, mesma chamada usada pro convite
 * original - **não testado nesta sessão contra o caso real de "convite já
 * aceito"** (nenhum projeto Supabase real conectado, herdado da Fase 0);
 * se a pessoa já confirmou a conta, o Supabase deve recusar o reenvio, e o
 * erro é repassado como mensagem genérica em vez de travar a ação.
 */
export async function resendMemberInvite(
  tenantId: string,
  profileId: string,
): Promise<TenantActionState> {
  const session = await requireTenantAccess(tenantId);
  const role = await getTenantRole(tenantId);
  if (role !== "owner") {
    return { error: "Só o responsável pela empresa pode reenviar convites." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    return { error: "Pessoa não encontrada." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    data: { full_name: profile.full_name },
  });

  if (error) {
    console.error("[tenants] falha ao reenviar convite:", error);
    return { error: "Não foi possível reenviar o convite - a pessoa pode já ter aceitado." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "tenant_member.invite_resent",
    entity: "tenant_member",
    entity_id: profileId,
  });

  return { success: "Convite reenviado." };
}
