# Arquitetura - Fase 6

## Banco de dados

`supabase/migrations/0019_notification_enhancements.sql`:

- `notifications.title` (text, default `''`) e `notifications.metadata_sanitized` (jsonb) - novos. `tenant_id`/`recipient_id` (já existentes desde 0015) NÃO foram renomeados pra "organization_id"/"user_id" do diagrama do prompt - mesma convenção de nome já usada em toda outra tabela do projeto. Ver `decisions.md` D2.

## `src/lib/notifications.ts` - reescrito

- `dispatchNotification()` (interna) - único ponto que insere em `notifications` e chama o adapter de e-mail. Centraliza o kill switch (`isFeatureEnabled("notifications")`, Fase 5) e o assunto genérico do e-mail (`NOTIFICATION_TITLES[type]` - nunca o corpo específico do evento, satisfaz "sem dados sensíveis em assunto de e-mail").
- `resolveCounterpartRecipients()` (interna) - extraída de `notifyTicketOrMessageEvent` original, reaproveitada por `notifyDocumentAvailable` (mesma lógica "staff age -> avisa a empresa; empresa age -> avisa o time WJB").
- `notifyTicketOrMessageEvent` - mesmo comportamento externo de antes (Fase 3), só reescrita por dentro pra usar `dispatchNotification`.
- `notifyDocumentAvailable` (novo) - chamado por `uploadDocument`.
- `notifyIntegrationStatus` (novo) - chamado por `syncOmieClient` quando a sincronização falha; só in-app (`sendEmail: false`), exclui quem já viu o resultado inline (`excludeActorId`).
- `notifyAccountSecurity` (novo) - chamado por `suspendAccount`/`reactivateAccount` (staff.ts) e `suspendMember`/`reactivateMember` (tenants.ts). Sempre com e-mail (a pessoa pode estar sem conseguir logar).
- `notifyInvitation` (novo) - chamado por `inviteMember`/`inviteStaffMember`, só no convite inicial (ver `decisions.md` D3).
- `listNotifications` - agora seleciona/devolve `title`/`metadataSanitized` também.
- `markNotificationAsReadAndGetLink(id)` (novo) - lê o `link` (RLS `notifications_select_own` garante isolamento - `id` de outra pessoa não retorna nada), marca como lida, devolve o link. Usado pela rota nova.
- `markAllNotificationsAsRead` - mesma função de antes, agora chamada só por ação explícita (não mais automaticamente ao visitar a página).

## Centro de notificações - "marcar como lida" virou ação explícita

**Antes (Fase 3)**: `NotificationsList` chamava `markAllNotificationsAsRead()` toda vez que a página carregava - side effect de renderizar, não uma ação do usuário.

**Agora**: cada notificação linka pra `GET /api/notifications/[id]/read` (`src/app/api/notifications/[id]/read/route.ts`) - mesmo padrão de "auditar/agir no redirect" de `/api/documents/[id]/download` (Fase 3): marca só aquela notificação como lida e redireciona (307) pro destino real. Um botão "Marcar todas como lidas" (só aparece se houver não lida) submete pra `markAllNotificationsRead` (`src/actions/notifications.ts`, novo), que chama a função de lib e revalida os dois caminhos possíveis (`/portal/notificacoes`, `/admin/notificacoes`).

## "Precisa de ajuda?" (Dashboard do Portal)

`src/components/portal/support-card.tsx` (novo), renderizado no fim de `/portal/page.tsx`. 3 caminhos: WhatsApp (`getWhatsAppLink()`, já existente, número real), e-mail (`mailto:${siteConfig.contact.email}`), "Abrir chamado" (`/portal/suporte`, infraestrutura de Tickets já existente desde a SAAS FASE 3/4 - o prompt permite ticket "se a infraestrutura já existir").

## Disparo real por tipo

| Tipo | Disparo | Canal |
|---|---|---|
| `invitation` | `inviteMember`/`inviteStaffMember` (convite inicial) | in-app + e-mail |
| `document_available` | `uploadDocument` | in-app + e-mail |
| `document_requested` | nenhum - sem feature real de "solicitar documento" | - |
| `integration_status` | `syncOmieClient` (só em falha) | in-app |
| `account_security` | `suspendAccount`/`reactivateAccount`/`suspendMember`/`reactivateMember` | in-app + e-mail |
| `system_message` | nenhum - sem feature real de broadcast/aviso | - |
| `ticket.*`/`message.sent` | já existiam (Fase 3) | in-app + e-mail |
