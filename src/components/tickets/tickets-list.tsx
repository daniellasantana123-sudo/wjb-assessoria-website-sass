import Link from "next/link";

import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { listTickets } from "@/lib/tickets";

export async function TicketsList({
  tenantId,
  basePath,
  showTenant = false,
}: {
  tenantId?: string;
  basePath: string;
  showTenant?: boolean;
}) {
  const tickets = await listTickets(tenantId);

  if (tickets.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Nenhum chamado {tenantId ? "ainda" : "recebido ainda"}.
      </p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          href={`${basePath}/${ticket.id}`}
          className="hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-4 p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-foreground truncate font-medium">{ticket.subject}</p>
              {showTenant && ticket.tenantName && (
                <span className="text-muted-foreground text-xs">{ticket.tenantName}</span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {ticket.messageCount} {ticket.messageCount === 1 ? "mensagem" : "mensagens"} · aberto
              em{" "}
              {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}
              {ticket.lastMessageAt &&
                ` · última em ${new Date(ticket.lastMessageAt).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </Link>
      ))}
    </div>
  );
}
