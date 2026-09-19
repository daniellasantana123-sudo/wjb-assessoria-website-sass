import { revokeStaffAccess } from "@/actions/staff";
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
    .select("id, full_name, email, staff_role")
    .eq("is_wjb_staff", true)
    .order("full_name", { ascending: true });

  if (!staff || staff.length === 0) {
    return <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma pessoa ainda.</p>;
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {staff.map((person) => (
        <div key={person.id} className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-foreground font-medium">{person.full_name ?? person.email}</p>
            <p className="text-muted-foreground text-sm">{person.email}</p>
          </div>

          {canManage && person.staff_role ? (
            <div className="flex shrink-0 items-center gap-3">
              <StaffRoleSelect profileId={person.id} role={person.staff_role} />
              {person.id !== currentUserId && (
                <form
                  action={async () => {
                    "use server";
                    await revokeStaffAccess(person.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-danger hover:text-danger focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Revogar
                  </button>
                </form>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground shrink-0 text-sm">{person.staff_role}</span>
          )}
        </div>
      ))}
    </div>
  );
}
