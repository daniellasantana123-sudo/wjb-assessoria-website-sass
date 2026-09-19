"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession, requireTenantAccess } from "@/lib/auth/dal";
import { notifyTicketOrMessageEvent } from "@/lib/notifications";
import { canHandleSupport } from "@/lib/permissions/roles";
import { createTicketSchema, replyTicketSchema } from "@/lib/validation/ticket";
import type { TicketStatus } from "@/types/database";

const ticketStatusLabels: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Resolvido",
};

export type TicketActionState = { error: string } | undefined;

/**
 * Abrir um chamado é dos dois lados — cliente reporta um problema, ou a
 * própria WJB registra um chamado em nome do cliente (`requireTenantAccess`
 * libera staff ou membro do tenant, mesmo padrão de `inviteMember`). Cria
 * o ticket e a primeira mensagem juntos, atomicamente o suficiente pra um
 * MVP (sem transação explícita — se a segunda escrita falhar, o ticket
 * fica sem mensagem, tratado como erro genérico ao usuário).
 */
export async function createTicket(
  tenantId: string,
  _prevState: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const session = await requireTenantAccess(tenantId);

  const validated = createTicketSchema.safeParse({
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({ tenant_id: tenantId, subject: validated.data.subject, created_by: session.userId })
    .select()
    .single();

  if (error || !ticket) {
    console.error("[tickets] falha ao criar ticket:", error);
    return { error: "Não foi possível abrir o chamado." };
  }

  const { error: messageError } = await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    tenant_id: tenantId,
    author_id: session.userId,
    body: validated.data.body,
  });

  if (messageError) {
    console.error("[tickets] falha ao criar mensagem inicial:", messageError);
    return { error: "Chamado criado, mas a mensagem não foi salva. Tente responder de novo." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "ticket.created",
    entity: "ticket",
    entity_id: ticket.id,
    metadata: { subject: ticket.subject },
  });

  await notifyTicketOrMessageEvent({
    tenantId,
    actorId: session.userId,
    actorIsStaff: session.isWjbStaff,
    type: "ticket.created",
    body: `Novo chamado: "${ticket.subject}"`,
    portalLink: `/portal/suporte/${ticket.id}`,
    adminLink: `/admin/tickets/${ticket.id}`,
  });

  revalidatePath("/portal/suporte");
  revalidatePath("/admin/tickets");
  redirect(session.isWjbStaff ? `/admin/tickets/${ticket.id}` : `/portal/suporte/${ticket.id}`);
}

/**
 * Responder uma thread — cliente e staff, mesma regra de acesso da leitura.
 *
 * `tenantId` aqui **nunca** é usado sem antes ser confirmado contra o
 * `tenant_id` real do ticket (achado numa revisão de segurança, SAAS FASE
 * 6): como `replyTicket` é uma Server Action, ela é uma URL chamável
 * diretamente, não só um clique na UI — sem essa checagem, um membro
 * autenticado do tenant A poderia mandar `ticketId` de um chamado do
 * tenant B junto com o próprio `tenantId` (A), que passa por
 * `requireTenantAccess`. O insert então gravaria uma mensagem com
 * `ticket_id` apontando pro chamado de B mas `tenant_id: A` — invisível
 * pro cliente B (RLS filtra pelo `tenant_id` da própria linha), mas
 * visível pro staff olhando o chamado de B (staff sempre vê tudo), como
 * se fosse uma resposta legítima. Buscar o ticket primeiro, com o client
 * de sessão (RLS já filtra: só volta linha se o chamador tiver acesso de
 * verdade), fecha o buraco — o `tenant_id` usado no insert/notificação
 * sempre vem do próprio ticket, nunca do parâmetro.
 */
export async function replyTicket(
  ticketId: string,
  tenantId: string,
  _prevState: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const session = await requireTenantAccess(tenantId);

  const validated = replyTicketSchema.safeParse({ body: String(formData.get("body") ?? "") });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("tenant_id, subject")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return { error: "Chamado não encontrado." };
  }

  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    tenant_id: ticket.tenant_id,
    author_id: session.userId,
    body: validated.data.body,
  });

  if (error) {
    console.error("[tickets] falha ao responder:", error);
    return { error: "Não foi possível enviar a mensagem." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: ticket.tenant_id,
    action: "ticket.replied",
    entity: "ticket",
    entity_id: ticketId,
  });

  await notifyTicketOrMessageEvent({
    tenantId: ticket.tenant_id,
    actorId: session.userId,
    actorIsStaff: session.isWjbStaff,
    type: "ticket.replied",
    body: `Nova resposta no chamado "${ticket.subject}"`,
    portalLink: `/portal/suporte/${ticketId}`,
    adminLink: `/admin/tickets/${ticketId}`,
  });

  revalidatePath(`/portal/suporte/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return undefined;
}

/**
 * Mudar status é exclusivo de staff — cliente acompanha, não fecha sozinho.
 * Não recebe `tenantId` de propósito — usa sempre o `tenant_id` real
 * devolvido pelo próprio update (mesmo racional de segurança do fix em
 * `replyTicket` acima: nunca confiar num id de tenant vindo do cliente
 * pra rotular a ação de um recurso que já existe).
 */
export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const session = await requireStaffSession();
  if (!canHandleSupport(session)) return;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .update({ status })
    .eq("id", ticketId)
    .select("tenant_id, subject")
    .maybeSingle();

  if (!ticket) return;

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: ticket.tenant_id,
    action: "ticket.status_changed",
    entity: "ticket",
    entity_id: ticketId,
    metadata: { status },
  });

  await notifyTicketOrMessageEvent({
    tenantId: ticket.tenant_id,
    actorId: session.userId,
    actorIsStaff: true,
    type: "ticket.status_changed",
    body: `Chamado "${ticket.subject}" agora está: ${ticketStatusLabels[status]}`,
    portalLink: `/portal/suporte/${ticketId}`,
    adminLink: `/admin/tickets/${ticketId}`,
  });

  revalidatePath(`/portal/suporte/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}
