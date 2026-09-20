"use server";

import { revalidatePath } from "next/cache";

import { markAllNotificationsAsRead } from "@/lib/notifications";

/**
 * "Marcar todas como lidas" (Fase 6) - a própria função de `lib` já
 * resolve o destinatário pela sessão (RLS `notifications_update_own`),
 * nenhum parâmetro client-trusted aqui. `NotificationsList` é
 * compartilhada entre Portal e Admin, então revalida os dois caminhos -
 * barato, mesmo padrão de `uploadDocument` revalidando várias rotas.
 */
export async function markAllNotificationsRead() {
  await markAllNotificationsAsRead();
  revalidatePath("/portal/notificacoes");
  revalidatePath("/admin/notificacoes");
}
