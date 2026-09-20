import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { MembersList } from "@/components/tenant/members-list";
import { InviteMemberForm } from "@/components/tenant/invite-member-form";
import { requireSession, getTenantRole } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Usuários",
  robots: { index: false, follow: false },
};

/**
 * Só o `owner` da empresa vê o formulário de convite — `member` só
 * enxerga os colegas (RLS também bloquearia o insert, mas nem mostrar a
 * opção já evita confusão).
 */
export default async function PortalUsuariosPage() {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);
  const role = tenant ? await getTenantRole(tenant.id) : null;

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Usuários" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Usuários</h1>
        {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, você poderá ver e convidar colegas
            aqui.
          </p>
        </div>
      ) : (
        <>
          <MembersList tenantId={tenant.id} />

          {role === "owner" ? (
            <div className="border-border rounded-md border p-6">
              <h2 className="text-foreground mb-4 text-sm font-semibold">Convidar colega</h2>
              <InviteMemberForm tenantId={tenant.id} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Só o responsável pela empresa pode convidar novas pessoas.
            </p>
          )}
        </>
      )}
    </Container>
  );
}
