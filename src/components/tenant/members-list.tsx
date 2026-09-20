import {
  reactivateMember,
  resendMemberInvite,
  revokeMemberAccess,
  suspendMember,
  updateMemberRole,
} from "@/actions/tenants";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/supabase/server";

const roleLabels: Record<string, string> = {
  owner: "Responsável",
  member: "Membro",
};

/**
 * `canManage` (Fase 2 do wjb-saas-mvp, 2026-09-20) — só o Admin WJB passa
 * `true` (ver `/admin/empresas/[id]`); no Portal do Cliente
 * (`/portal/usuarios`) o mesmo componente é usado sem essa prop, então
 * ninguém vê os controles de suspender/reativar — suspender colega de
 * empresa é ação de staff, mais sensível que convidar (que o `owner` já
 * pode fazer sozinho).
 *
 * Fase 5: ganhou trocar papel, revogar acesso (hard delete, diferente de
 * suspender) e reenviar convite — mesmo gate `canManage`.
 */
export async function MembersList({
  tenantId,
  canManage = false,
}: {
  tenantId: string;
  canManage?: boolean;
}) {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, role, status, profiles(id, full_name, email)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (!members || members.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-sm">Nenhum membro ainda.</p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {members.map((member) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        return (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-foreground font-medium">
                  {profile?.full_name ?? profile?.email ?? "-"}
                </p>
                <p className="text-muted-foreground text-sm">{profile?.email}</p>
              </div>
              {member.status === "suspended" && <Badge tone="danger">Suspenso</Badge>}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-sm">
                {roleLabels[member.role] ?? member.role}
              </span>
              {canManage && profile?.id && (
                <>
                  <form
                    action={async () => {
                      "use server";
                      await updateMemberRole(
                        tenantId,
                        profile.id,
                        member.role === "owner" ? "member" : "owner",
                      );
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      {member.role === "owner" ? "Tornar membro" : "Tornar responsável"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      if (member.status === "suspended") {
                        await reactivateMember(tenantId, profile.id);
                      } else {
                        await suspendMember(tenantId, profile.id);
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      {member.status === "suspended" ? "Reativar" : "Suspender"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await resendMemberInvite(tenantId, profile.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Reenviar convite
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await revokeMemberAccess(tenantId, profile.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-danger hover:text-danger/80 focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Revogar acesso
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
