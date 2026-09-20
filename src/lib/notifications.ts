import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import { getEmailAdapter } from "@/integrations/email";
import { renderNotificationEmail } from "@/integrations/email/templates";
import { getSiteUrl } from "@/lib/seo/site-url";
import { isFeatureEnabled } from "@/lib/feature-flags";

export type NotificationType =
  | "ticket.created"
  | "ticket.replied"
  | "ticket.status_changed"
  | "message.sent";

const notificationEmailTitles: Record<NotificationType, string> = {
  "ticket.created": "Novo chamado aberto",
  "ticket.replied": "Nova resposta no chamado",
  "ticket.status_changed": "Status do chamado alterado",
  "message.sent": "Nova mensagem",
};

/**
 * Fan-out de notificação (uma linha por destinatário) a partir de um
 * evento real de Tickets/Mensagens. Usa o client admin (service_role) de
 * propósito — inserir uma notificação para OUTRA pessoa nunca passaria
 * pela RLS de `notifications` (que só libera cada um mexer na própria
 * linha), e quem chama isto já passou pela autorização da própria Server
 * Action (`requireTenantAccess`/`requireStaffSession`).
 *
 * `actorIsStaff` decide quem recebe: staff agindo notifica os membros do
 * tenant (link pro Portal); cliente agindo notifica todo o time WJB (link
 * pro Admin) — nunca o próprio autor do evento.
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
  // Kill switch global (Fase 5) - nem notificação in-app nem e-mail saem daqui, de propósito, se desligada.
  if (!(await isFeatureEnabled("notifications"))) return;

  const admin = createAdminClient();

  let recipients: { id: string; email: string | null }[];
  let link: string;
  let ctaLabel: string;

  if (actorIsStaff) {
    const { data } = await admin
      .from("tenant_members")
      .select("profile_id, profiles(email)")
      .eq("tenant_id", tenantId);
    recipients = (data ?? []).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { id: row.profile_id, email: profile?.email ?? null };
    });
    link = portalLink;
    ctaLabel = "Ver no Portal";
  } else {
    const { data } = await admin.from("profiles").select("id, email").eq("is_wjb_staff", true);
    recipients = (data ?? []).map((row) => ({ id: row.id, email: row.email }));
    link = adminLink;
    ctaLabel = "Ver no Admin";
  }

  recipients = recipients.filter((recipient) => recipient.id !== actorId);
  if (recipients.length === 0) return;

  await admin.from("notifications").insert(
    recipients.map((recipient) => ({
      recipient_id: recipient.id,
      tenant_id: tenantId,
      type,
      body,
      link,
    })),
  );

  /**
   * E-mail é best-effort — nunca deve derrubar a Server Action que disparou
   * o evento (o registro em `notifications`/`audit_log` já aconteceu). Sem
   * `RESEND_API_KEY`/`EMAIL_FROM` configuradas, `getEmailAdapter()` devolve
   * o adapter no-op (só loga), então isto é seguro mesmo antes do domínio
   * estar verificado no Resend.
   */
  const emailAdapter = getEmailAdapter();
  const absoluteLink = new URL(link, getSiteUrl()).toString();
  const title = notificationEmailTitles[type];
  const results = await Promise.allSettled(
    recipients
      .filter((recipient) => recipient.email)
      .map((recipient) =>
        emailAdapter.send({
          to: recipient.email as string,
          subject: `WJB Assessoria Contábil — ${title}`,
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

export interface NotificationItem {
  id: string;
  type: string;
  body: string;
  link: string;
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
    .select("id, type, body, link, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    body: row.body,
    link: row.link,
    read: row.read_at !== null,
    createdAt: row.created_at,
  }));
}

/** Contagem de não lidas — pro badge da sidebar (Portal) e do card (Admin). */
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

/** Marca tudo como lido — chamado ao visitar a página de notificações. */
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
