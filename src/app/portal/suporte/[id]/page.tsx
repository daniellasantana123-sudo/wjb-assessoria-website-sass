import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Chamado",
  robots: { index: false, follow: false },
};

/**
 * `canManageStatus` sempre `false` aqui — mudar status é ação exclusiva do
 * Admin WJB (`/admin/tickets/[id]`), mesmo que um staff acabe abrindo essa
 * rota por engano. A RLS de `tickets`/`ticket_messages` já garante que só
 * quem pertence à empresa (ou é staff) enxerga o chamado — `getTicket`
 * retorna `null` (tratado como "não encontrado") pra qualquer outro caso.
 */
export default async function PortalTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "Suporte", href: "/portal/suporte" },
          { label: "Chamado" },
        ]}
      />

      <TicketThread ticketId={id} canManageStatus={false} />
    </Container>
  );
}
