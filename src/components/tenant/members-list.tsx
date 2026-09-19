import { createClient } from "@/lib/db/supabase/server";

const roleLabels: Record<string, string> = {
  owner: "Responsável",
  member: "Membro",
};

export async function MembersList({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, role, profiles(id, full_name, email)")
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
          <div key={member.id} className="flex items-center justify-between p-4">
            <div>
              <p className="text-foreground font-medium">
                {profile?.full_name ?? profile?.email ?? "-"}
              </p>
              <p className="text-muted-foreground text-sm">{profile?.email}</p>
            </div>
            <span className="text-muted-foreground text-sm">
              {roleLabels[member.role] ?? member.role}
            </span>
          </div>
        );
      })}
    </div>
  );
}
