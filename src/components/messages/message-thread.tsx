import { SendMessageForm } from "@/components/messages/send-message-form";
import { listMessages } from "@/lib/messages";
import { cn } from "@/lib/utils";

export async function MessageThread({ tenantId }: { tenantId: string }) {
  const messages = await listMessages(tenantId);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border p-8 text-center text-sm">
          Nenhuma mensagem ainda. Escreva a primeira abaixo.
        </p>
      ) : (
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
      )}

      <SendMessageForm tenantId={tenantId} />
    </div>
  );
}
