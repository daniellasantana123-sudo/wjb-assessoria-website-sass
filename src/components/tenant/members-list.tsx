import {
  reactivateMember,
  resendMemberInvite,
  revokeMemberAccess,
  suspendMember,
  updateMemberRole,
} from "@/actions/tenants";
import { ActionButton } from "@/components/shared/action-button";
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
        const personLabel = profile?.full_name ?? profile?.email ?? "-";
        return (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <p className="text-foreground font-medium break-words">{personLabel}</p>
                <p className="text-muted-foreground text-sm break-all">{profile?.email}</p>
              </div>
              {member.status === "suspended" && <Badge tone="danger">Suspenso</Badge>}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground text-sm">
                {roleLabels[member.role] ?? member.role}
              </span>
              {canManage && profile?.id && (
                <>
                  <ActionButton
                    label={member.role === "owner" ? "Tornar membro" : "Tornar responsável"}
                    confirmMessage={
                      member.role === "owner"
                        ? `Tornar ${personLabel} membro? A pessoa deixa de poder convidar colegas.`
                        : `Tornar ${personLabel} responsável? A pessoa passa a poder convidar colegas desta empresa.`
                    }
                    action={async () => {
                      "use server";
                      await updateMemberRole(
                        tenantId,
                        profile.id,
                        member.role === "owner" ? "member" : "owner",
                      );
                    }}
                  />
                  <ActionButton
                    label={member.status === "suspended" ? "Reativar" : "Suspender"}
                    confirmMessage={
                      member.status === "suspended"
                        ? undefined
                        : `Suspender o acesso de ${personLabel} a esta empresa?`
                    }
                    action={async () => {
                      "use server";
                      if (member.status === "suspended") {
                        await reactivateMember(tenantId, profile.id);
                      } else {
                        await suspendMember(tenantId, profile.id);
                      }
                    }}
                  />
                  <ActionButton
                    label="Reenviar convite"
                    pendingLabel="Enviando..."
                    action={async () => {
                      "use server";
                      return resendMemberInvite(tenantId, profile.id);
                    }}
                  />
                  <ActionButton
                    label="Revogar acesso"
                    tone="danger"
                    confirmMessage={`Revogar o acesso de ${personLabel} a esta empresa? O vínculo é removido de vez.`}
                    action={async () => {
                      "use server";
                      await revokeMemberAccess(tenantId, profile.id);
                    }}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
