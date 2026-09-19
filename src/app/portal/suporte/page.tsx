import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { CreateTicketForm } from "@/components/tickets/create-ticket-form";
import { TicketsList } from "@/components/tickets/tickets-list";
import { requireSession } from "@/lib/auth/dal";
import { getMyPrimaryTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Suporte",
  robots: { index: false, follow: false },
};

export default async function PortalSuportePage() {
  const session = await requireSession();
  const tenant = await getMyPrimaryTenant(session.userId);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Suporte" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Suporte</h1>
        {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, você poderá abrir chamados aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="border-border rounded-md border p-6">
            <h2 className="text-foreground mb-4 text-sm font-semibold">Abrir novo chamado</h2>
            <CreateTicketForm tenantId={tenant.id} />
          </div>

          <TicketsList tenantId={tenant.id} basePath="/portal/suporte" />
        </>
      )}
    </Container>
  );
}
