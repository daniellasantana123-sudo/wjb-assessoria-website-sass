import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { requireStaffSession } from "@/lib/auth/dal";
import { canHandleSupport } from "@/lib/permissions/roles";

export const metadata: Metadata = {
  title: "Chamado",
  robots: { index: false, follow: false },
};

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Tickets", href: "/admin/tickets" },
          { label: "Chamado" },
        ]}
      />

      <TicketThread ticketId={id} canManageStatus={canHandleSupport(session)} />
    </Container>
  );
}
