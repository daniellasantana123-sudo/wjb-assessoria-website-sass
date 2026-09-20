import Link from "next/link";

import { markAllNotificationsRead } from "@/actions/notifications";
import { listNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/**
 * Lista compartilhada entre Portal e Admin (o destinatário já é resolvido
 * pela sessão logada dentro de `listNotifications`, não por prop).
 *
 * Fase 6 do wjb-saas-mvp: "marcar como lida" e "marcar todas como lidas"
 * viraram ações explícitas da UI (antes, a Fase 3 marcava tudo como lido
 * automaticamente ao visitar a página - efeito colateral de renderizar,
 * não uma ação do usuário). Cada notificação agora linka pra
 * `/api/notifications/[id]/read` (marca só aquela como lida e redireciona
 * pro destino real, mesmo padrão de `/api/documents/[id]/download`).
 */
export async function NotificationsList() {
  const notifications = await listNotifications();

  if (notifications.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma notificação ainda.</p>
    );
  }

  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <div className="flex flex-col gap-3">
      {hasUnread && (
        <form action={markAllNotificationsRead} className="self-end">
          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Marcar todas como lidas
          </button>
        </form>
      )}

      <div className="border-border divide-border divide-y rounded-md border">
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            href={`/api/notifications/${notification.id}/read`}
            className={cn(
              "hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-4 p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              !notification.read && "bg-primary/5",
            )}
          >
            <div className="flex items-center gap-3">
              {!notification.read && (
                <span aria-hidden="true" className="bg-primary h-2 w-2 shrink-0 rounded-full" />
              )}
              <div>
                {notification.title && (
                  <p className="text-foreground text-sm font-medium">{notification.title}</p>
                )}
                <p className="text-muted-foreground text-sm">{notification.body}</p>
              </div>
            </div>
            <p className="text-muted-foreground shrink-0 text-xs">
              {new Date(notification.createdAt).toLocaleString("pt-BR")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
