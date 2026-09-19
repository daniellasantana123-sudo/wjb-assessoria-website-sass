"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { requireStaffSession, requireTenantAccess, getTenantRole } from "@/lib/auth/dal";
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
