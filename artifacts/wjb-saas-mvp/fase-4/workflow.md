# Workflow da Fase 4

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 05_FASE_4_OMIE_GCLICK_MVP.md] --> B[Ler Claude.md, roadmap.md, artifacts das Fases 0-3]
    B --> C{Contradicao: prompt pede Omie, decisao de produto diz sem Omie}
    C --> D[Perguntar ao usuario como proceder]
    D --> E[Usuario decide: reverter a decisao e implementar de verdade]
    E --> F[Auditar schema/RLS existentes - obligations como referencia de padrao staff-write/tenant-read]
    F --> G[Migration 0017: enum omie_integration_status + tabela omie_client_mappings]
    G --> H[Adapter Pattern: src/integrations/omie-gclick, no-op sem credenciais]
    H --> I[Permissions: integrations.read/integrations.manage]
    I --> J[Server Actions: saveOmieMapping, syncOmieClient, setOmieMappingDisabled]
    J --> K[UI staff: OmieMappingPanel em /admin/empresas/id]
    K --> L[UI cliente: OmiePortalCta em /portal]
    L --> M[Escrever testes - adapter e actions]
    M --> N[Rodar lint, typecheck, test, build]
    N --> O{Tudo limpo?}
    O -->|Nao| M
    O -->|Sim| P[Reverter docs/product/roadmap.md e docs/api/integrations.md]
    P --> Q[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    Q --> R[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - Sincronização de cliente (staff aciona)

```mermaid
sequenceDiagram
    participant S as Staff (Admin WJB)
    participant Panel as OmieMappingPanel
    participant Action as syncOmieClient (Server Action)
    participant DB as Postgres (RLS)
    participant Adapter as OmieGClickAdapter
    participant Omie as API Omie
    participant Audit as audit_log

    S->>Panel: clica "Sincronizar com o Omie.G-Click"
    Panel->>Action: syncOmieClient(tenantId)
    Action->>Action: requireStaffSession + hasPermission("integrations.manage")
    alt sem permissao
        Action-->>Panel: erro
    else com permissao
        Action->>DB: select tenants (name, cnpj) where id = tenantId
        Action->>DB: select omie_client_mappings where tenant_id = tenantId
        Action->>DB: upsert status = "syncing"
        Action->>Adapter: upsertClient({tenantId, name, cnpj, externalClientId})
        alt OMIE_APP_KEY/SECRET ausentes
            Adapter-->>Action: { ok: false, error: "no-provider" } (nunca lanca)
        else credenciais configuradas
            Adapter->>Omie: POST clientes/ (IncluirCliente | AlterarCliente)
            Omie-->>Adapter: codigo_cliente_omie ou faultstring
            Adapter-->>Action: { ok, externalClientId? , error? }
        end
        Action->>DB: upsert status = "synced" | "error", last_error
        Action->>Audit: insert integration.omie_sync_attempted (ok, error - sem credenciais)
        Action-->>Panel: sucesso ou erro
    end
```

## Fluxo de dados - CTA "Ver no Portal Contábil" (cliente)

```mermaid
flowchart TD
    A[Cliente abre /portal] --> B[getActiveTenant]
    B --> C[getOmieMapping tenantId - so le tabela local, nunca chama Omie ao vivo]
    C --> D{status e connected ou synced E external_portal_url existe?}
    D -->|Nao| E[CTA nao renderiza]
    D -->|Sim| F[Renderiza link target=_blank rel=noopener noreferrer]
    F --> G[Cliente clica - abre em nova aba, faz login la com as proprias credenciais]
```

## Dependências

- `src/lib/permissions/permissions.ts` (Fase 1) - `integrations.read`/`integrations.manage` novos.
- `src/lib/auth/dal.ts` (`requireStaffSession`) e `src/lib/tenant.ts` (`getActiveTenant`) - reaproveitados sem alteração.
- Nenhuma dependência npm nova (`fetch` nativo, mesmo padrão do adapter Meta WhatsApp).

## Testes

- `src/tests/unit/omie-gclick-adapter.test.ts` - 5 testes (Incluir vs. Alterar, faultstring tratado como erro sem lançar, falha de rede nunca lança, fallback no-op nunca chama a rede).
- `src/tests/integration/omie-gclick-actions.test.ts` - 11 testes (permissão em `saveOmieMapping`/`syncOmieClient`/`setOmieMappingDisabled`, validação de URL https, transições de status, auditoria, empresa inexistente).
- `src/tests/unit/permissions.test.ts` - 1 teste novo (`integrations.read` no cliente, nunca `integrations.manage`).

## Saídas

- 1 migration nova (`0017_omie_gclick_integration.sql`) + tipos em `src/types/database.ts`.
- 1 integração nova (`src/integrations/omie-gclick/`).
- 1 arquivo de Server Actions novo (`src/actions/omie-gclick.ts`).
- 1 helper de leitura novo (`src/lib/omie-gclick.ts`) + validação (`src/lib/validation/omie-gclick.ts`).
- 3 componentes novos (`OmieStatusBadge`, `OmieMappingPanel`, `OmiePortalCta`).
- `docs/product/roadmap.md` e `docs/api/integrations.md` atualizados (decisão revertida, documentado).
- 17 testes novos.

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo - fase concluída.
