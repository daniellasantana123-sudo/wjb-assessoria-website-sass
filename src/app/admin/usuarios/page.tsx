import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { StaffList } from "@/components/staff/staff-list";
import { InviteStaffForm } from "@/components/staff/invite-staff-form";
import { requireStaffSession } from "@/lib/auth/dal";
import { isSuperAdmin } from "@/lib/permissions/roles";

export const metadata: Metadata = {
  title: "Usuários",
  robots: { index: false, follow: false },
};

/**
 * Time interno da WJB (staff), diferente de "Usuários" do Portal do
 * Cliente (colegas de uma empresa cliente — /portal/usuarios). Conceder
 * acesso/trocar papel/revogar é exclusivo de `super_admin` — qualquer
 * staff só visualiza.
 */
export default async function AdminUsuariosPage() {
  const session = await requireStaffSession();
  const canManage = isSuperAdmin(session);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Usuários" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Usuários</h1>
        <p className="text-muted-foreground mt-1 text-sm">Time interno da WJB.</p>
      </div>

      <StaffList currentUserId={session.userId} canManage={canManage} />

      {canManage ? (
        <div className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Conceder acesso</h2>
          <InviteStaffForm />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Só super_admin pode conceder acesso a novas pessoas.
        </p>
      )}
    </Container>
  );
}
