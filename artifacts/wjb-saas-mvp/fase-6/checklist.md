# Checklist de aceite - Fase 6

## Tipos

- [x] `invitation` - disparo real (`inviteMember`/`inviteStaffMember`).
- [x] `document_available` - disparo real (`uploadDocument`).
- [x] `document_requested` - definido, sem disparo (sem feature real). Ver `decisions.md` D4.
- [x] `integration_status` - disparo real (`syncOmieClient`, em falha).
- [x] `account_security` - disparo real (suspensão/reativação de conta e de vínculo).
- [x] `system_message` - definido, sem disparo (sem feature real). Ver `decisions.md` D4.

## Canais MVP

- [x] In-app - todos os 4 tipos com disparo real gravam em `notifications`.
- [x] E-mail - todos exceto `integration_status` (decisão deliberada, D5).
- [x] WhatsApp deliberadamente não usado para notificação (o prompt permite adiar).

## Modelo

- [x] `notifications.organization_id` -> mantido como `tenant_id` (já existia). Ver `decisions.md` D2.
- [x] `user_id` -> mantido como `recipient_id` (já existia). Ver `decisions.md` D2.
- [x] `type`, `title` (novo), `body`, `read_at`, `metadata_sanitized` (novo), `created_at` - todos presentes.

## Centro de notificações

- [x] Badge - já existia (sidebar do Portal, nav mobile, card do Admin).
- [x] Lista - já existia, agora mostra `title` além do `body`.
- [x] Marcar como lida - novo, ação explícita por notificação (`/api/notifications/[id]/read`).
- [x] Marcar todas como lidas - novo, botão explícito (antes era automático ao visitar a página - ver `decisions.md` D1).
- [x] Empty state - já existia ("Nenhuma notificação ainda.").

## Suporte

- [x] "Precisa de ajuda?" no Dashboard - novo (`SupportCard`).
- [x] WhatsApp oficial - `getWhatsAppLink()`, já existente.
- [x] E-mail - `mailto:` com o e-mail real da WJB.
- [x] Ticket - `/portal/suporte`, infraestrutura já existente (SAAS FASE 3/4).

## Critérios de aceite do prompt

- [x] Notificações por tenant - `tenant_id` em toda notificação relevante.
- [x] In-app - confirmado.
- [x] E-mail - confirmado (exceto `integration_status`, deliberado).
- [x] Read state - `read_at`, marcar individual e em lote.
- [x] Sem dados sensíveis em assunto de e-mail - assunto sempre `NOTIFICATION_TITLES[type]`, genérico.
- [x] Suporte acessível - `SupportCard` no Dashboard.
- [x] Mobile - revisão de código (sem ferramenta de navegador nesta sessão). Ver `decisions.md` D7.

## Verificação técnica

- [x] Lint limpo.
- [x] Typecheck limpo.
- [x] 170 testes passando (23 novos desta fase).
- [x] Build limpo, incluindo a rota nova `/api/notifications/[id]/read`.
