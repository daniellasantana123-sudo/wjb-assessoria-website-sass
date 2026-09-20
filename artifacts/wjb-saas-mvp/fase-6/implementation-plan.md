# Plano de implementação - Fase 6

1. Auditar o centro de notificações e a infraestrutura de suporte já existentes (SAAS FASE 3/4) contra as 6 seções do prompt.
2. Migration `0019_notification_enhancements.sql`: `title`, `metadata_sanitized`.
3. Tipos manuais em `src/types/database.ts` (mesma limitação herdada da Fase 0).
4. Reescrever `src/lib/notifications.ts`: extrair `dispatchNotification`/`resolveCounterpartRecipients`, adicionar `notifyInvitation`, `notifyDocumentAvailable`, `notifyIntegrationStatus`, `notifyAccountSecurity`, `markNotificationAsReadAndGetLink`; manter `notifyTicketOrMessageEvent`/`listNotifications`/`getUnreadNotificationCount`/`markAllNotificationsAsRead` compatíveis.
5. Wire dos 4 disparos reais: `inviteMember`/`inviteStaffMember` (tenants.ts/staff.ts), `uploadDocument` (documents.ts), `syncOmieClient` (omie-gclick.ts), `suspendAccount`/`reactivateAccount`/`suspendMember`/`reactivateMember` (staff.ts/tenants.ts).
6. Rota `GET /api/notifications/[id]/read` + gate em `src/proxy.ts`.
7. Server Action `markAllNotificationsRead` (`src/actions/notifications.ts`).
8. Reescrever `NotificationsList` (botão "marcar todas", link individual pra rota nova, mostra `title`).
9. `SupportCard` no Dashboard do Portal.
10. Testes: `lib/notifications.ts` completo, rota nova, wiring de convite; atualizar mocks dos testes existentes que agora tocam `@/lib/notifications`.
11. Lint, typecheck, test, build.
12. Escrever os 7 artifacts + atualizar `STATUS.md`.

Nenhum item deste plano dependia de credenciais Supabase/Resend reais além do que as Fases anteriores já dependiam (mock em testes, mesma limitação herdada).
