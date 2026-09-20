# Workflow da Fase 6

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 07_FASE_6_NOTIFICACOES_SUPORTE.md] --> B[Ler Claude.md, artifacts das Fases 0-5]
    B --> C[Auditar centro de notificacoes e suporte existentes]
    C --> D[Achado: notifications/badge/lista/email ja existem desde SAAS FASE 3]
    D --> E[Achado real: so 4 tipos existem hoje, nenhum dos 6 do prompt]
    E --> F[Achado real: marcar como lida e automatico, nao uma acao explicita]
    F --> G[Achado real: Dashboard nao tem Precisa de ajuda]
    G --> H[Migration 0019: title + metadata_sanitized]
    H --> I[Reescrever lib/notifications.ts - dispatch centralizado]
    I --> J[Wire invitation/document_available/integration_status/account_security]
    J --> K[Rota /api/notifications/id/read + acao marcar todas]
    K --> L[Componente SupportCard no Dashboard]
    L --> M[Testes - lib, rota, wiring nas actions existentes]
    M --> N[Rodar lint, typecheck, test, build]
    N --> O{Tudo limpo?}
    O -->|Nao| M
    O -->|Sim| P[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    P --> Q[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - Convite dispara notificação

```mermaid
sequenceDiagram
    participant Staff as Staff ou Owner
    participant Action as inviteMember / inviteStaffMember
    participant Auth as Supabase Auth (nativo)
    participant Dispatch as dispatchNotification
    participant DB as notifications
    participant Email as EmailAdapter

    Staff->>Action: convida pessoa
    Action->>Auth: inviteUserByEmail (link de acesso nativo)
    Action->>DB: insert tenant_members / update profiles
    Action->>Dispatch: notifyInvitation(recipientId, email, link)
    Dispatch->>Dispatch: isFeatureEnabled("notifications")?
    alt desligada
        Dispatch-->>Action: nao faz nada
    else ligada
        Dispatch->>DB: insert notification (type=invitation, title generico)
        Dispatch->>Email: send (assunto generico, corpo com o convite)
        Email-->>Dispatch: ok ou erro (best-effort, nunca lanca)
    end
```

## Fluxo de dados - Marcar como lida (individual) via redirect auditado

```mermaid
flowchart TD
    A[Clique na notificacao] --> B[GET /api/notifications/id/read]
    B --> C{Sessao valida?}
    C -->|Nao| D[401]
    C -->|Sim| E[markNotificationAsReadAndGetLink id]
    E --> F{RLS encontrou a notificacao da propria pessoa?}
    F -->|Nao| G[404]
    F -->|Sim| H[update read_at]
    H --> I[307 redirect pro link real]
```

## Dependências

- `src/lib/feature-flags.ts` (Fase 5) - kill switch `notifications`, único ponto de checagem em `dispatchNotification`.
- `src/integrations/email` (Fase 5 de integrações) - reaproveitado sem alteração.
- `src/integrations/whatsapp` (V1) - `getWhatsAppLink()` reaproveitado no `SupportCard`.
- Nenhuma dependência npm nova.

## Testes

- `src/tests/unit/notifications.test.ts` (novo) - 18 testes: todas as funções públicas de `lib/notifications.ts` (dispatch, resolução de destinatários, kill switch, assunto genérico, listagem, contagem, marcar lida individual/todas).
- `src/tests/integration/notifications-read-api.test.ts` (novo) - 3 testes (401, 404, 307 com marcação).
- `src/tests/integration/invite-notifications.test.ts` (novo) - 2 testes (convite de membro e de staff disparam `notifyInvitation`).
- `src/tests/integration/documents-upload-action.test.ts`, `account-status-actions.test.ts`, `omie-gclick-actions.test.ts` - atualizados (mock de `@/lib/notifications`) + 3 novas asserções cobrindo o disparo real de cada evento.

## Saídas

- 1 migration nova (`0019_notification_enhancements.sql`) + tipos em `src/types/database.ts`.
- `src/lib/notifications.ts` reescrito (6 tipos, 4 funções públicas novas).
- 1 rota nova (`GET /api/notifications/[id]/read`) + 1 Server Action nova (`src/actions/notifications.ts`).
- 1 componente novo (`SupportCard`) + `NotificationsList` reescrito.
- 4 Server Actions existentes (`inviteMember`, `inviteStaffMember`, `uploadDocument`, `suspendAccount`/`reactivateAccount`, `suspendMember`/`reactivateMember`, `syncOmieClient`) ganharam disparo de notificação.
- 23 testes novos.

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo - fase concluída.
