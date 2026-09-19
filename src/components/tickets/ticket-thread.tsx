import { ReplyForm } from "@/components/tickets/reply-form";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketStatusSelect } from "@/components/tickets/ticket-status-select";
import { getTicket, listTicketMessages } from "@/lib/tickets";
import { cn } from "@/lib/utils";

export async function TicketThread({
  ticketId,
  canManageStatus = false,
}: {
  ticketId: string;
  canManageStatus?: boolean;
}) {
  const ticket = await getTicket(ticketId);

  if (!ticket) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">Chamado não encontrado.</p>
    );
  }

  const messages = await listTicketMessages(ticketId);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 rounded-md border p-6">
        <div>
          <h1 className="text-foreground text-xl font-semibold">{ticket.subject}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {ticket.tenantName} · aberto em {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {canManageStatus ? (
          <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
        ) : (
          <TicketStatusBadge status={ticket.status} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-xl rounded-md border p-4",
              message.authorIsStaff
                ? "border-primary/20 bg-primary/5 self-start"
                : "border-border bg-background self-end",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground text-sm font-medium">
                {message.authorName ?? "Pessoa sem nome"}
                {message.authorIsStaff && (
                  <span className="text-primary ml-1.5 text-xs font-normal">(WJB)</span>
                )}
              </p>
              <p className="text-muted-foreground shrink-0 text-xs">
                {new Date(message.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <p className="text-foreground mt-2 text-sm whitespace-pre-wrap">{message.body}</p>
          </div>
        ))}
      </div>

      {ticket.status === "closed" ? (
        <p className="text-muted-foreground border-border rounded-md border p-4 text-center text-sm">
          Este chamado foi marcado como resolvido.
          {canManageStatus && " Mude o status acima para reabrir."}
        </p>
      ) : (
        <ReplyForm ticketId={ticket.id} tenantId={ticket.tenantId} />
      )}
    </div>
  );
}
