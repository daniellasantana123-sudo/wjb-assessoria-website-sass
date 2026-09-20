# Status - wjb-saas-mvp

## Fase atual

**Fase 6 - Notificações e suporte**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |
| Fase 3 - Documentos | Concluída | 2026-09-20 |
| Fase 4 - Omie.G-Click MVP | Concluída | 2026-09-20 |
| Fase 5 - Console Admin WJB | Concluída | 2026-09-20 |
| Fase 6 - Notificações e suporte | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `supabase/migrations/0019_notification_enhancements.sql` - novo (`title`, `metadata_sanitized`).
- `src/types/database.ts` - `notifications` atualizado.
- `src/lib/notifications.ts` - reescrito (`dispatchNotification`, `resolveCounterpartRecipients`, `notifyInvitation`, `notifyDocumentAvailable`, `notifyIntegrationStatus`, `notifyAccountSecurity`, `markNotificationAsReadAndGetLink`).
- `src/actions/notifications.ts` - novo (`markAllNotificationsRead`).
- `src/app/api/notifications/[id]/read/route.ts` - novo.
- `src/components/notifications/notifications-list.tsx` - reescrito (marcar lida/todas explícitos).
- `src/components/portal/support-card.tsx` - novo ("Precisa de ajuda?").
- `src/app/portal/page.tsx` - `SupportCard` no Dashboard.
- `src/actions/tenants.ts`, `src/actions/staff.ts`, `src/actions/documents.ts`, `src/actions/omie-gclick.ts` - disparo de notificação wireado em convite/documento/integração/segurança.
- `src/proxy.ts` - `/api/notifications` adicionado ao gate do SaaS.
- 3 arquivos de teste novos (`notifications` unit, `notifications-read-api`, `invite-notifications`) + mocks/asserções atualizados em 3 arquivos existentes.
- `artifacts/wjb-saas-mvp/fase-6/*` - criado.

Nenhuma dependência npm nova.

## Testes

Lint, typecheck, 170 testes (147 anteriores + 23 novos) e build de produção - todos passando. Detalhe completo em `fase-6/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes em todos os ambientes acessíveis - notificações só testadas via mock, não contra banco/e-mail reais.
- Herdado da Fase 5 de integrações: `RESEND_API_KEY`/`EMAIL_FROM` ausentes em produção - todo e-mail desta fase cai no adapter no-op até isso ser configurado.
- Mudança de comportamento perceptível: "marcar como lida" deixou de ser automático ao visitar a página - ver `fase-6/decisions.md` D1.
- Mobile não verificado visualmente nesta sessão (sem ferramenta de navegador) - ver `fase-6/decisions.md` D7.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 6.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (revertida na Fase 4, mantida)

A integração Omie.G-Click faz parte do projeto desde 2026-09-20 (Fase 4), revertendo a decisão de 2026-09-16 de não integrar nenhum ERP/fiscal externo. Só o recurso "clientes" (+ "testar conexão", Fase 5) foi implementado - "tarefas"/"pré-tarefas" seguem fora do escopo por falta de documentação pública verificada.
