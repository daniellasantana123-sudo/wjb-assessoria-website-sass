# Relatório de testes e build - Fase 6

Executado em 2026-09-20, branch `main`.

## Lint

```text
$ npm run lint
> eslint
(sem saída - sem erros nem avisos)
```

## Typecheck

```text
$ npm run typecheck
> next typegen && tsc --noEmit
✓ Types generated successfully
(sem erros)
```

## Testes (Vitest)

```text
$ npm run test
 Test Files  24 passed (24)
      Tests  170 passed (170)
```

170 testes = 147 já existentes (Fases 0-5) + 23 novos desta fase:

- `src/tests/unit/notifications.test.ts` (novo) - 18 testes: `notifyInvitation` (insere + e-mail com assunto genérico, sem e-mail cadastrado, kill switch desligado), `notifyTicketOrMessageEvent` (staff->empresa, cliente->WJB, sem destinatário), `notifyDocumentAvailable` (staff->guia no Portal, cliente->Admin), `notifyIntegrationStatus` (exclui o autor, sem e-mail), `notifyAccountSecurity` (in-app + e-mail genérico), `listNotifications` (sem sessão, mapeamento completo), `getUnreadNotificationCount`, `markAllNotificationsAsRead`, `markNotificationAsReadAndGetLink` (não encontrada vs. encontrada).
- `src/tests/integration/notifications-read-api.test.ts` (novo) - 3 testes (401, 404, 307 com marcação e redirect).
- `src/tests/integration/invite-notifications.test.ts` (novo) - 2 testes (`inviteMember` e `inviteStaffMember` disparam `notifyInvitation` com os parâmetros certos).
- `src/tests/integration/documents-upload-action.test.ts`, `account-status-actions.test.ts`, `omie-gclick-actions.test.ts` - mocks atualizados (`@/lib/notifications`) + assert do disparo real em cada evento (não conta como teste novo, mesmo `it` de antes).

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages using 3 workers (82/82)
```

Rota nova confirmada na saída: `ƒ /api/notifications/[id]/read`.
