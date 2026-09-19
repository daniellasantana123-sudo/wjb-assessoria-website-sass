import Link from "next/link";

import { listNotifications, markAllNotificationsAsRead } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/**
 * Lista compartilhada entre Portal e Admin (o destinatário já é resolvido
 * pela sessão logada dentro de `listNotifications`, não por prop). Marca
 * tudo como lido *depois* de capturar a lista — assim esta visita ainda
 * mostra o que estava não lido (destacado), só a próxima carrega tudo lido.
 */
export async function NotificationsList() {
  const notifications = await listNotifications();
  await markAllNotificationsAsRead();

  if (notifications.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma notificação ainda.</p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {notifications.map((notification) => (
        <Link
          key={notification.id}
          href={notification.link}
          className={cn(
            "hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-4 p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            !notification.read && "bg-primary/5",
          )}
        >
          <div className="flex items-center gap-3">
            {!notification.read && (
              <span aria-hidden="true" className="bg-primary h-2 w-2 shrink-0 rounded-full" />
            )}
            <p className="text-foreground text-sm">{notification.body}</p>
          </div>
          <p className="text-muted-foreground shrink-0 text-xs">
            {new Date(notification.createdAt).toLocaleString("pt-BR")}
          </p>
        </Link>
      ))}
    </div>
  );
}
