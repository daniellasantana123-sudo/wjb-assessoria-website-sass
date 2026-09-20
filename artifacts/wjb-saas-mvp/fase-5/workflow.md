# Workflow da Fase 5

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 06_FASE_5_ADMIN_WJB.md] --> B[Ler Claude.md, artifacts das Fases 0-4]
    B --> C[Auditar console Admin WJB existente por secao do prompt]
    C --> D[Achado: Empresas/Usuarios/Omie ja tinham boa parte pronta]
    D --> E[Achado real: busca/editar/suspender EMPRESA nao existiam]
    E --> F[Achado de seguranca real: my_tenant_ids nao respeitava status]
    F --> G[Achado real: trocar role/revogar acesso/reenviar convite de tenant_member nao existiam]
    G --> H[Achado real: sem visao Omie entre empresas, sem testar conexao]
    H --> I[Achado real: feature flags nao existiam]
    I --> J[Achado real: logs sem filtro nenhum]
    J --> K[Migration 0018: tenants.status + fix RLS + feature_flags]
    K --> L[Server Actions novas + permissoes finas ja mortas finalmente usadas]
    L --> M[UI: empresas, membros, staff, integracoes, logs]
    M --> N[Testes - inclusive privilege escalation]
    N --> O[Rodar lint, typecheck, test, build]
    O --> P{Tudo limpo?}
    P -->|Nao| N
    P -->|Sim| Q[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    Q --> R[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - Suspender empresa (corta acesso de todos os membros)

```mermaid
sequenceDiagram
    participant S as Staff (super_admin)
    participant Page as /admin/empresas/[id]
    participant Action as suspendTenant
    participant DB as Postgres (RLS)
    participant Member as Membro da empresa

    S->>Page: clica "Suspender empresa"
    Page->>Action: suspendTenant(tenantId)
    Action->>Action: requireStaffSession + hasPermission("tenants.suspend")
    alt sem permissao (contador/atendimento)
        Action-->>Page: nao faz nada
    else super_admin
        Action->>DB: update tenants set status = 'suspended'
        Action->>DB: insert audit_log (tenant.suspended)
        Note over DB: my_tenant_ids() agora exclui esse tenant_id
        Member->>DB: qualquer leitura de documents/obligations/tickets/...
        DB-->>Member: vazio (RLS bloqueia via my_tenant_ids)
        Member->>Page: getMyOrganizations - tenant nao aparece mais no switcher
    end
```

## Fluxo de dados - Feature flag desativa uma feature globalmente

```mermaid
flowchart TD
    A[super_admin desativa 'documents' em /admin/integracoes] --> B[setFeatureFlag upsert feature_flags]
    B --> C[audit_log: feature_flag.updated]
    D[Cliente tenta enviar documento] --> E[uploadDocument]
    E --> F{isFeatureEnabled documents?}
    F -->|Nao| G[Erro: envio temporariamente desativado]
    F -->|Sim| H[Segue fluxo normal - MIME, antimalware, upload]
```

## Dependências

- `my_tenant_ids()`/`is_tenant_owner()` (0003) - redefinidas (mesma assinatura) na migration 0018.
- `src/lib/permissions/permissions.ts` (Fase 1) - `organizations.manage`/`members.manage`/`integrations.manage` finalmente usadas; `feature_flags.manage`/`tenants.suspend` novas.
- Nenhuma dependência npm nova.

## Testes

- `src/tests/integration/admin-console-actions.test.ts` (novo) - 14 testes (updateTenant, suspendTenant/reactivateTenant com privilege escalation, updateMemberRole, revokeMemberAccess, resendMemberInvite, resendStaffInvite com privilege escalation, setFeatureFlag com privilege escalation).
- `src/tests/unit/feature-flags.test.ts` (novo) - 3 testes (fallback seguro, lista completa mesmo com banco incompleto).
- `src/tests/unit/audit-log.test.ts` (novo) - 8 testes (cada filtro isoladamente, busca por usuário sem resultado, mapeamento de linha, `listTenantOptions`).
- `src/tests/integration/omie-gclick-actions.test.ts` - 4 novos (`testOmieConnection`: sem permissão/sucesso/falha; gate de feature flag em `syncOmieClient`).
- `src/tests/integration/documents-upload-action.test.ts` - 1 novo (gate de feature flag em `uploadDocument`).
- `src/tests/unit/permissions.test.ts` - 1 novo (`feature_flags.manage`/`tenants.suspend` só super_admin).

## Saídas

- 1 migration nova (`0018_admin_console.sql`) + tipos em `src/types/database.ts`.
- 2 métodos novos no adapter/actions Omie (`testConnection`/`testOmieConnection`).
- 1 módulo novo (`src/lib/feature-flags.ts`) + 1 arquivo de Server Action (`src/actions/feature-flags.ts`).
- 6 Server Actions novas em `src/actions/tenants.ts` + 1 em `src/actions/staff.ts`.
- 1 página nova (`/admin/integracoes`) + filtros em `/admin/logs` + busca/edição/suspensão em `/admin/empresas`.
- 31 testes novos.

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo - fase concluída.
