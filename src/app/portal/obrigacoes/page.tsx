import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { ObligationsList } from "@/components/obligations/obligations-list";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Obrigações",
  robots: { index: false, follow: false },
};

export default async function PortalObrigacoesPage() {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Obrigações" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Obrigações</h1>
        {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, as obrigações fiscais aparecem
            aqui.
          </p>
        </div>
      ) : (
        <ObligationsList
          tenantId={tenant.id}
          detailHref={(id) => `/portal/obrigacoes/${id}`}
        />
      )}
    </Container>
  );
}
