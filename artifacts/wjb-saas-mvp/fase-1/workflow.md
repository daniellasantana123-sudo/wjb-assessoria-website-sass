# Workflow da Fase 1

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 02_FASE_1_BACKEND_FOUNDATION.md] --> B[Ler artifacts da Fase 0]
    B --> C{Comparar dominios pedidos com o que ja existe}
    C --> D[Achado: users/organizations/memberships/roles/invitations/<br/>sessions/audit/feature-flags ja existem, com outros nomes]
    D --> E[Apresentar mapeamento ao usuario antes de codar]
    E --> F{Usuario decide}
    F -->|Fechar so os gaps reais| G[Nao renomear tenants/tenant_members]
    F -->|Migrar de verdade| Z[Reescrita completa - nao escolhido]
    G --> H[Criar src/lib/permissions/permissions.ts]
    H --> I[Criar GET /api/me]
    I --> J[Criar GET /api/me/organizations]
    J --> K[Adicionar /api/me ao gate do proxy.ts]
    K --> L[Escrever testes unitarios e de integracao]
    L --> M[Rodar lint, typecheck, test, build]
    M --> N{Tudo limpo?}
    N -->|Sim| O[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    N -->|Nao| L
    O --> P[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - GET /api/me

```mermaid
sequenceDiagram
    participant C as Cliente HTTP
    participant R as /api/me (route.ts)
    participant DAL as src/lib/auth/dal.ts
    participant Tenant as src/lib/tenant.ts
    participant Perm as src/lib/permissions/permissions.ts
    participant DB as Supabase (Postgres + RLS)

    C->>R: GET /api/me (cookie de sessao)
    R->>DAL: getSession()
    DAL->>DB: auth.getUser() + profiles
    DB-->>DAL: usuario + perfil
    DAL-->>R: Session ou null
    alt sem sessao
        R-->>C: 401 Nao autenticado
    else staff
        R->>Perm: getPermissions(session)
        Perm-->>R: permissoes de staffRole
        R-->>C: 200 organizationId=null, role=null, permissions
    else cliente
        R->>Tenant: getMyPrimaryTenant(userId)
        Tenant->>DB: tenant_members join tenants
        DB-->>Tenant: empresa ou null
        Tenant-->>R: empresa
        R->>DAL: getTenantRole(tenantId)
        DAL->>DB: tenant_members.role
        DB-->>DAL: owner ou member
        DAL-->>R: role
        R->>Perm: getPermissions(session, role)
        Perm-->>R: permissoes de tenant
        R-->>C: 200 organizationId, role, permissions
    end
```

## Dependências

- `src/lib/auth/dal.ts` (`getSession`, `getTenantRole`) - já existente, não alterado.
- `src/lib/tenant.ts` (`getMyPrimaryTenant`) - já existente, não alterado.
- `src/types/database.ts` (`StaffRole`, `TenantMemberRole`) - já existente, não alterado.
- Nenhuma dependência nova instalada (nenhum pacote npm adicionado).

## Testes

- `src/tests/unit/permissions.test.ts` - 7 testes cobrindo `getPermissions`/`hasPermission` para staff (3 papéis) e cliente (owner/member), incluindo os casos sem `staffRole`/`tenantRole`.
- `src/tests/integration/me-api.test.ts` - 4 testes cobrindo `GET /api/me` (401 sem sessão, staff, cliente com empresa, cliente sem empresa).
- `src/tests/integration/me-organizations-api.test.ts` - 3 testes cobrindo `GET /api/me/organizations` (401, staff recebe lista vazia, cliente recebe empresas vinculadas).

## Saídas

- 2 rotas novas (`/api/me`, `/api/me/organizations`), 1 módulo novo de permissões, 1 linha adicionada ao gate do `proxy.ts`, 16 testes novos.

## Critério para avançar

Todos os itens do checklist marcados, lint/typecheck/test/build limpos (ver `test-report.md`) - fase concluída.
