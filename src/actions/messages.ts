"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireTenantAccess } from "@/lib/auth/dal";
import { notifyTicketOrMessageEvent } from "@/lib/notifications";
import { sendMessageSchema } from "@/lib/validation/message";

export type MessageActionState = { error: string } | undefined;

/** Enviar mensagem na conversa contínua da empresa — cliente e staff, sem assunto/status. */
export async function sendMessage(
  tenantId: string,
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const session = await requireTenantAccess(tenantId);

  const validated = sendMessageSchema.safeParse({
    body: String(formData.get("body") ?? ""),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    tenant_id: tenantId,
    author_id: session.userId,
    body: validated.data.body,
  });

  if (error) {
    console.error("[messages] falha ao enviar:", error);
    return { error: "Não foi possível enviar a mensagem." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "message.sent",
    entity: "message",
  });

  await notifyTicketOrMessageEvent({
    tenantId,
    actorId: session.userId,
    actorIsStaff: session.isWjbStaff,
    type: "message.sent",
    body: "Nova mensagem",
    portalLink: "/portal/mensagens",
    adminLink: `/admin/mensagens/${tenantId}`,
  });

  revalidatePath("/portal/mensagens");
  revalidatePath(`/admin/mensagens/${tenantId}`);
  revalidatePath("/admin/mensagens");
  return undefined;
}
