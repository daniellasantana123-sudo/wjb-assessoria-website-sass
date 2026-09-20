import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import { getEmailAdapter } from "@/integrations/email";
import { renderNotificationEmail } from "@/integrations/email/templates";
import { getSiteUrl } from "@/lib/seo/site-url";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Fase 6 do wjb-saas-mvp - os 4 tipos de baixo já existiam (SAAS FASE 3,
 * eventos de Tickets/Mensagens). Os 6 de cima são os pedidos pelo prompt
 * desta fase: `invitation`/`document_available`/`integration_status`/
 * `account_security` têm disparo real (ver funções abaixo);
 * `document_requested`/`system_message` ficam definidas (título pronto,
 * union de tipo cobrindo) mas sem nenhum disparo - não existe hoje uma
 * feature de "WJB solicita um documento específico ao cliente" nem um
 * "enviar aviso" de broadcast, e inventar um disparo pra elas seria
 * simular uma funcionalidade que não existe (mesmo racional já usado pro
 * status `conflict` do Omie na Fase 4/5).
 */
export type NotificationType =
  | "invitation"
  | "document_available"
  | "document_requested"
  | "integration_status"
  | "account_security"
  | "system_message"
  | "ticket.created"
  | "ticket.replied"
  | "ticket.status_changed"
  | "message.sent";

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  invitation: "Você foi convidado(a)",
  document_available: "Novo documento disponível",
  document_requested: "Documento solicitado",
  integration_status: "Status de integração atualizado",
  account_security: "Alteração de segurança na sua conta",
  system_message: "Aviso da WJB",
  "ticket.created": "Novo chamado aberto",
  "ticket.replied": "Nova resposta no chamado",
  "ticket.status_changed": "Status do chamado alterado",
  "message.sent": "Nova mensagem",
};

interface NotificationRecipient {
  id: string;
  email: string | null;
}

/**
 * Fan-out de notificação (uma linha por destinatário) + e-mail best-effort
 * - usada por toda função pública deste módulo, único lugar que insere em
 * `notifications`/chama o adapter de e-mail. Usa o client admin
 * (service_role) de propósito - inserir uma notificação pra OUTRA pessoa
 * nunca passaria pela RLS de `notifications` (só libera cada um mexer na
 * própria linha); quem chama isto já passou pela autorização da própria
 * Server Action.
 *
 * Kill switch global (Fase 5, `notifications`) checado aqui - único ponto
 * de checagem pra todo o módulo, nem notificação in-app nem e-mail saem
 * se estiver desligada.
 */
async function dispatchNotification({
  recipients,
  tenantId,
  type,
  body,
  link,
  metadataSanitized,
  ctaLabel = "Ver detalhes",
  sendEmail = true,
}: {
  recipients: NotificationRecipient[];
  tenantId: string | null;
  type: NotificationType;
  body: string;
  link: string;
  metadataSanitized?: Record<string, unknown>;
  ctaLabel?: string;
  sendEmail?: boolean;
}) {
  if (recipients.length === 0) return;
  if (!(await isFeatureEnabled("notifications"))) return;

  const admin = createAdminClient();
  const title = NOTIFICATION_TITLES[type];

  await admin.from("notifications").insert(
    recipients.map((recipient) => ({
      recipient_id: recipient.id,
      tenant_id: tenantId,
      type,
      title,
      body,
      link,
      metadata_sanitized: metadataSanitized ?? null,
    })),
  );

  if (!sendEmail) return;

  /**
   * E-mail é best-effort - nunca deve derrubar a Server Action que disparou
   * o evento (o registro em `notifications` já aconteceu). Sem
   * `RESEND_API_KEY`/`EMAIL_FROM` configuradas, `getEmailAdapter()` devolve
   * o adapter no-op (só loga), então isto é seguro mesmo antes do domínio
   * estar verificado no Resend. Assunto sempre genérico (`title`) - nunca
   * carrega detalhe sensível, o conteúdo específico só aparece no corpo.
   */
  const emailAdapter = getEmailAdapter();
  const absoluteLink = new URL(link, getSiteUrl()).toString();
  const results = await Promise.allSettled(
    recipients
      .filter((recipient) => recipient.email)
      .map((recipient) =>
        emailAdapter.send({
          to: recipient.email as string,
          subject: `WJB Assessoria Contábil - ${title}`,
          html: renderNotificationEmail({ title, body, ctaLabel, ctaUrl: absoluteLink }),
          text: `${body}\n\n${ctaLabel}: ${absoluteLink}`,
        }),
      ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[notifications] falha ao enviar e-mail de notificação:", result.reason);
    }
  }
}

/** Membros do tenant (se quem agiu foi staff) ou todo o time WJB (se quem agiu foi cliente) - nunca o próprio autor. */
async function resolveCounterpartRecipients(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  actorId: string,
  actorIsStaff: boolean,
): Promise<NotificationRecipient[]> {
  let recipients: NotificationRecipient[];

  if (actorIsStaff) {
    const { data } = await admin
      .from("tenant_members")
      .select("profile_id, profiles(email)")
      .eq("tenant_id", tenantId);
    recipients = (data ?? []).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { id: row.profile_id, email: profile?.email ?? null };
    });
  } else {
    const { data } = await admin.from("profiles").select("id, email").eq("is_wjb_staff", true);
    recipients = (data ?? []).map((row) => ({ id: row.id, email: row.email }));
  }

  return recipients.filter((recipient) => recipient.id !== actorId);
}

/**
 * `actorIsStaff` decide quem recebe: staff agindo notifica os membros do
 * tenant (link pro Portal); cliente agindo notifica todo o time WJB (link
 * pro Admin) - nunca o próprio autor do evento.
 */
export async function notifyTicketOrMessageEvent({
  tenantId,
  actorId,
  actorIsStaff,
  type,
  body,
  portalLink,
  adminLink,
}: {
  tenantId: string;
  actorId: string;
  actorIsStaff: boolean;
  type: NotificationType;
  body: string;
  portalLink: string;
  adminLink: string;
}) {
  const admin = createAdminClient();
  const recipients = await resolveCounterpartRecipients(admin, tenantId, actorId, actorIsStaff);

  await dispatchNotification({
    recipients,
    tenantId,
    type,
    body,
    link: actorIsStaff ? portalLink : adminLink,
    ctaLabel: actorIsStaff ? "Ver no Portal" : "Ver no Admin",
  });
}

/**
 * Documento/guia enviado (Fase 6) - mesma lógica de contraparte de
 * `notifyTicketOrMessageEvent`: staff envia -> avisa a empresa; empresa
 * envia -> avisa o time WJB.
 */
export async function notifyDocumentAvailable({
  tenantId,
  actorId,
  actorIsStaff,
  fileName,
  category,
}: {
  tenantId: string;
  actorId: string;
  actorIsStaff: boolean;
  fileName: string;
  category: "documento" | "guia";
}) {
  const admin = createAdminClient();
  const recipients = await resolveCounterpartRecipients(admin, tenantId, actorId, actorIsStaff);

  const label = category === "guia" ? "Guia" : "Documento";
  const link = actorIsStaff
    ? category === "guia"
      ? "/portal/guias"
      : "/portal/documentos"
    : `/admin/empresas/${tenantId}`;

  await dispatchNotification({
    recipients,
    tenantId,
    type: "document_available",
    body: `${label} enviado: "${fileName}"`,
    link,
    metadataSanitized: { file_name: fileName, category },
    ctaLabel: actorIsStaff ? "Ver no Portal" : "Ver no Admin",
  });
}

/**
 * Status de integração (Fase 6) - hoje só disparado quando uma
 * sincronização com o Omie.G-Click falha (ver `syncOmieClient`). Avisa
 * todo o time WJB, só in-app (sem e-mail - operacional, não urgente o
 * bastante pra justificar e-mail a cada tentativa).
 */
export async function notifyIntegrationStatus({
  message,
  link,
  excludeActorId,
}: {
  message: string;
  link: string;
  /** Quem já viu o resultado inline (ex.: quem clicou em "Sincronizar") não precisa da notificação duplicada. */
  excludeActorId?: string;
}) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, email").eq("is_wjb_staff", true);
  const recipients: NotificationRecipient[] = (data ?? [])
    .map((row) => ({ id: row.id, email: row.email }))
    .filter((recipient) => recipient.id !== excludeActorId);

  await dispatchNotification({
    recipients,
    tenantId: null,
    type: "integration_status",
    body: message,
    link,
    sendEmail: false,
  });
}

/**
 * Segurança da conta (Fase 6) - suspensão/reativação de conta (staff) ou
 * de vínculo com uma empresa (cliente). Sempre com e-mail (a pessoa pode
 * estar sem conseguir logar, então in-app sozinho não bastaria) - assunto
 * sempre genérico ("Alteração de segurança"), nunca revela o motivo.
 */
export async function notifyAccountSecurity({
  recipientId,
  recipientEmail,
  tenantId,
  message,
  link,
}: {
  recipientId: string;
  recipientEmail: string | null;
  tenantId?: string | null;
  message: string;
  link: string;
}) {
  await dispatchNotification({
    recipients: [{ id: recipientId, email: recipientEmail }],
    tenantId: tenantId ?? null,
    type: "account_security",
    body: message,
    link,
  });
}

/**
 * Convite (Fase 6) - disparado só no convite inicial, não no reenvio
 * (`resendMemberInvite`/`resendStaffInvite` já reenviam o e-mail nativo do
 * Supabase Auth com o link de acesso; mandar mais um e-mail WJB junto
 * seria redundante/confuso). Ver `decisions.md` D3.
 */
export async function notifyInvitation({
  recipientId,
  recipientEmail,
  tenantId,
  link,
}: {
  recipientId: string;
  recipientEmail: string | null;
  tenantId?: string | null;
  link: string;
}) {
  await dispatchNotification({
    recipients: [{ id: recipientId, email: recipientEmail }],
    tenantId: tenantId ?? null,
    type: "invitation",
    body: "Você foi convidado(a) para acessar a Plataforma WJB.",
    link,
  });
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  metadataSanitized: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

/** Últimas 50 notificações da pessoa logada, mais recente primeiro. */
export async function listNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, metadata_sanitized, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    metadataSanitized: row.metadata_sanitized,
    read: row.read_at !== null,
    createdAt: row.created_at,
  }));
}

/** Contagem de não lidas - pro badge da sidebar (Portal) e do card (Admin). */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}

/**
 * Marca UMA notificação como lida e devolve o link de destino - usada
 * pela rota `GET /api/notifications/[id]/read` (Fase 6), mesmo padrão de
 * "auditar/agir no redirect" já usado em `/api/documents/[id]/download`.
 * O client normal (RLS `notifications_select_own`/`_update_own`) já
 * garante isolamento: um `id` de notificação de outra pessoa simplesmente
 * não retorna nada.
 */
export async function markNotificationAsReadAndGetLink(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();

  if (!data) return null;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  return data.link;
}

/**
 * Marca tudo como lido - agora só via ação explícita do usuário ("Marcar
 * todas como lidas", Fase 6), não mais automaticamente ao visitar a
 * página (comportamento antigo da Fase 3) - o prompt desta fase pede
 * "marcar como lida"/"marcar todas como lidas" como ações da UI, não como
 * efeito colateral de renderizar a lista.
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
}
