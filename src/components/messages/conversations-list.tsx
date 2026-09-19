import Link from "next/link";

import { listConversations } from "@/lib/messages";

export async function ConversationsList() {
  const conversations = await listConversations();

  if (conversations.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma empresa cadastrada ainda.</p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {conversations.map((conversation) => (
        <Link
          key={conversation.tenantId}
          href={`/admin/mensagens/${conversation.tenantId}`}
          className="hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-4 p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <p className="text-foreground truncate font-medium">{conversation.tenantName}</p>
          <p className="text-muted-foreground shrink-0 text-sm">
            {conversation.messageCount === 0
              ? "Sem mensagens ainda"
              : `${conversation.messageCount} mensage${conversation.messageCount === 1 ? "m" : "ns"} · última em ${new Date(conversation.lastMessageAt!).toLocaleDateString("pt-BR")}`}
          </p>
        </Link>
      ))}
    </div>
  );
}
