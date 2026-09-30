import { reactivateAccount, resendStaffInvite, revokeStaffAccess, suspendAccount } from "@/actions/staff";
import { ActionButton } from "@/components/shared/action-button";
import { Badge } from "@/components/ui/badge";
import { StaffRoleSelect } from "@/components/staff/staff-role-select";
import { createClient } from "@/lib/db/supabase/server";

export async function StaffList({
  currentUserId,
  canManage = false,
}: {
  currentUserId: string;
  canManage?: boolean;
}) {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, staff_role, status")
    .eq("is_wjb_staff", true)
    .order("full_name", { ascending: true });

  if (!staff || staff.length === 0) {
    return <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma pessoa ainda.</p>;
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {staff.map((person) => {
        const isSelf = person.id === currentUserId;
        const personLabel = person.full_name ?? person.email;
        return (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <p className="text-foreground font-medium break-words">{personLabel}</p>
                <p className="text-muted-foreground text-sm break-all">{person.email}</p>
              </div>
              {person.status === "suspended" && <Badge tone="danger">Suspenso</Badge>}
            </div>

            {/*
              A própria pessoa não troca o próprio papel: uma super_admin que se
              rebaixasse por engano perderia o Admin sem volta (o trigger da
              migration 0022 impede outra pessoa não-super_admin de reverter).
            */}
            {canManage && person.staff_role && !isSelf ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StaffRoleSelect profileId={person.id} role={person.staff_role} personLabel={personLabel} />
                <ActionButton
                  label={person.status === "suspended" ? "Reativar" : "Suspender"}
                  confirmMessage={
                    person.status === "suspended"
                      ? undefined
                      : `Suspender o acesso de ${personLabel}? A pessoa deixa de conseguir entrar até ser reativada.`
                  }
                  action={async () => {
                    "use server";
                    if (person.status === "suspended") {
                      await reactivateAccount(person.id);
                    } else {
                      await suspendAccount(person.id);
                    }
                  }}
                />
                <ActionButton
                  label="Reenviar convite"
                  pendingLabel="Enviando..."
                  action={async () => {
                    "use server";
                    return resendStaffInvite(person.id);
                  }}
                />
                <ActionButton
                  label="Revogar"
                  tone="danger"
                  confirmMessage={`Revogar o acesso de ${personLabel} à área interna da WJB?`}
                  action={async () => {
                    "use server";
                    await revokeStaffAccess(person.id);
                  }}
                />
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">
                {person.staff_role}
                {isSelf ? " (você)" : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
