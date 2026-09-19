import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { TicketsList } from "@/components/tickets/tickets-list";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tickets",
  robots: { index: false, follow: false },
};

export default async function AdminTicketsPage() {
  await requireStaffSession();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Tickets" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Tickets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Chamados de suporte de todas as empresas clientes.
        </p>
      </div>

      <TicketsList basePath="/admin/tickets" showTenant />
    </Container>
  );
}
