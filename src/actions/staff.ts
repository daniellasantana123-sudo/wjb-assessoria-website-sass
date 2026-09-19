"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { requireStaffSession } from "@/lib/auth/dal";
import { isSuperAdmin } from "@/lib/permissions/roles";
import { inviteStaffSchema, type InviteStaffValues } from "@/lib/validation/staff";
import type { StaffRole } from "@/types/database";

export type StaffActionState = { error: string } | { success: string } | undefined;

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
    return { error: "Só super_admin pode adicionar novas pessoas à equipe da WJB." };
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
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      validated.data.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: { full_name: validated.data.fullName },
      },
    );

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
    metadata: { email: validated.data.email, staff_role: validated.data.staffRole },
  });

  revalidatePath("/admin/usuarios");
  return { success: "Acesso concedido." };
}

export async function updateStaffRole(profileId: string, staffRole: StaffRole) {
  const session = await requireStaffSession();
  if (!isSuperAdmin(session)) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ staff_role: staffRole }).eq("id", profileId);

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
