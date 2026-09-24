"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { requireStaffSession } from "@/lib/auth/dal";
import { isSuperAdmin } from "@/lib/permissions/roles";
import { notifyAccountSecurity, notifyInvitation } from "@/lib/notifications";
import {
  inviteStaffSchema,
  type InviteStaffValues,
} from "@/lib/validation/staff";
import type { StaffRole } from "@/types/database";
import { getAuthCallbackUrl } from "@/lib/seo/site-url";

export type StaffActionState =
  { error: string } | { success: string } | undefined;

/**
 * Conceder acesso interno (Admin WJB) é ação exclusiva de `super_admin` —
 * mais restrita que "qualquer staff" (RLS reforça isso independente desta
 * checagem, ver `0011_super_admin_manages_staff.sql`). Reaproveita o
 * convite nativo do Supabase Auth, mesmo padrão de `inviteMember`
 * (src/actions/tenants.ts) — se o e-mail já tem conta, só promove a
 * staff em vez de reenviar convite.
 */
export async function inviteStaffMember(
  _prevState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) {
    return {
      error: "Só super_admin pode adicionar novas pessoas à equipe da WJB.",
    };
  }

  const raw: InviteStaffValues = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    staffRole: formData.get("staffRole") as InviteStaffValues["staffRole"],
  };

  const validated = inviteStaffSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", validated.data.email)
    .maybeSingle();

  let profileId = existingProfile?.id;

  if (!profileId) {
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(validated.data.email, {
        redirectTo: getAuthCallbackUrl(),
        data: { full_name: validated.data.fullName },
      });

    if (inviteError || !invited.user) {
      console.error("[staff] falha ao convidar:", inviteError);
      return { error: "Não foi possível convidar esse e-mail." };
    }

    profileId = invited.user.id;
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      is_wjb_staff: true,
      staff_role: validated.data.staffRole,
      full_name: validated.data.fullName,
    })
    .eq("id", profileId);

  if (updateError) {
    console.error("[staff] falha ao promover a staff:", updateError);
    return { error: "Não foi possível conceder acesso." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "staff.invited",
    entity: "profile",
    entity_id: profileId,
    metadata: {
      email: validated.data.email,
      staff_role: validated.data.staffRole,
    },
  });

  // Notificação de convite (Fase 6) - só no convite inicial, ver decisions.md D3.
  await notifyInvitation({
    recipientId: profileId,
    recipientEmail: validated.data.email,
    link: "/admin",
  });

  revalidatePath("/admin/usuarios");
  return { success: "Acesso concedido." };
}

/**
 * Reenvia convite de acesso interno (Fase 5) - mesmo racional de
 * `resendMemberInvite` (`src/actions/tenants.ts`): reaproveita
 * `inviteUserByEmail`, não testado nesta sessão contra o caso "já aceito"
 * (sem projeto Supabase real conectado).
 */
export async function resendStaffInvite(
  profileId: string,
): Promise<StaffActionState> {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) {
    return {
      error: "Só super_admin pode reenviar convites de acesso interno.",
    };
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
    redirectTo: getAuthCallbackUrl(),
    data: { full_name: profile.full_name },
  });

  if (error) {
    console.error("[staff] falha ao reenviar convite:", error);
    return {
      error:
        "Não foi possível reenviar o convite - a pessoa pode já ter aceitado.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "staff.invite_resent",
    entity: "profile",
    entity_id: profileId,
  });

  return { success: "Convite reenviado." };
}

export async function updateStaffRole(profileId: string, staffRole: StaffRole) {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ staff_role: staffRole })
    .eq("id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "staff.role_changed",
    entity: "profile",
    entity_id: profileId,
    metadata: { staff_role: staffRole },
  });

  revalidatePath("/admin/usuarios");
}

/** Revoga acesso interno — não apaga a conta, só tira o papel de staff. */
export async function revokeStaffAccess(profileId: string) {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) return;
  if (profileId === session.userId) return; // não se auto-revoga por engano.

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ is_wjb_staff: false, staff_role: null })
    .eq("id", profileId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "staff.access_revoked",
    entity: "profile",
    entity_id: profileId,
  });

  revalidatePath("/admin/usuarios");
}

/**
 * Suspensão de conta (Fase 2 do wjb-saas-mvp, 2026-09-20) — mais severa que
 * `revokeStaffAccess`: bloqueia o LOGIN inteiro da pessoa (não só o papel de
 * staff), via `profiles.status` (migration 0016), checado em `getSession()`.
 * A checagem própria do projeto é o que garante o bloqueio de verdade e é
 * imediata (próxima página carregada); a chamada a `updateUserById` com
 * `ban_duration` é uma camada extra de defesa em profundidade usando o
 * próprio mecanismo do Supabase Auth, best-effort — não é o mecanismo do
 * qual este projeto depende pra bloquear o acesso.
 */
export async function suspendAccount(profileId: string) {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) return;
  if (profileId === session.userId) return; // não se auto-suspende por engano.

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", profileId);

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: "876000h", // ~100 anos — efetivamente indefinido, até reativar.
  });
  if (banError) {
    console.error(
      "[staff] falha ao bloquear login no Supabase Auth (best-effort):",
      banError,
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "account.suspended",
    entity: "profile",
    entity_id: profileId,
  });

  await notifyAccountStatusChange(supabase, profileId, "suspensa");

  revalidatePath("/admin/usuarios");
}

export async function reactivateAccount(profileId: string) {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId);

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: "none",
  });
  if (banError) {
    console.error(
      "[staff] falha ao remover bloqueio no Supabase Auth (best-effort):",
      banError,
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "account.reactivated",
    entity: "profile",
    entity_id: profileId,
  });

  await notifyAccountStatusChange(supabase, profileId, "reativada");

  revalidatePath("/admin/usuarios");
}

/** Notificação de segurança (Fase 6) - avisa a própria pessoa afetada, por e-mail (pode estar sem conseguir logar). */
async function notifyAccountStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  outcome: "suspensa" | "reativada",
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .maybeSingle();

  await notifyAccountSecurity({
    recipientId: profileId,
    recipientEmail: profile?.email ?? null,
    message: `Sua conta foi ${outcome} pela WJB.`,
    link: "/admin/seguranca",
  });
}
