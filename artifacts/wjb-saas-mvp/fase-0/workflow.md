# Workflow da Fase 0

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 01_FASE_0_AUDITORIA_BASELINE.md] --> B{Ler Claude.md e Wjb-Website.md}
    B --> C[git status / branch / log]
    C --> D{Achado: contradicao sobre escopo Omie/G-Click}
    D -->|Perguntar ao usuario| E[Usuario confirma: manter decisao 09-16, sem Omie]
    E --> F[Mapear stack: framework, banco, ORM, auth, storage, hosting]
    F --> G[Mapear login, dashboard, tenants, roles, permissions]
    G --> H[Auditar RLS, migrations, secrets]
    H --> I[Auditar integracoes existentes: email, whatsapp-business]
    I --> J[Rodar lint, typecheck, test, build]
    J --> K[Registrar divida tecnica, riscos, bloqueios]
    K --> L[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    L --> M[Escrever phase-handoff.md e STATUS.md]
    M --> N{Criterios de aceite atendidos?}
    N -->|Sim| O[Fase 0 concluida]
    N -->|Nao| K
```

## Arquitetura atual (Current State Architecture)

```mermaid
flowchart TB
    subgraph Cliente["Navegador"]
        Browser
    end

    subgraph NextApp["Next.js 16 (App Router) - Hostinger Node.js"]
        direction TB
        Proxy["src/proxy.ts (substitui middleware.ts)<br/>checagem otimista de cookie + gate NEXT_PUBLIC_SAAS_PUBLIC_ENABLED"]
        SiteGroup["(site) - V1 institucional + /admin"]
        Portal["/portal - app SaaS do cliente"]
        API["/api/leads (route handler)"]
        DAL["src/lib/auth/dal.ts<br/>requireSession / requireStaffSession"]
        Roles["src/lib/permissions/roles.ts<br/>isSuperAdmin / canManageObligations / canHandleSupport"]
        Tenant["src/lib/tenant.ts<br/>getMyPrimaryTenant / getTenantRole"]
        Integrations["src/integrations/<br/>email (Resend) e whatsapp-business (Meta Graph API)<br/>Adapter Pattern com fallback no-op"]
    end

    subgraph Supabase["Supabase (projeto wjb-website-app, sa-east-1)"]
        Auth["Supabase Auth"]
        DB[("Postgres + RLS<br/>15 migrations aplicadas (0001-0015)")]
        Storage["Storage - bucket privado documents"]
    end

    Browser --> Proxy
    Proxy --> SiteGroup
    Proxy --> Portal
    Proxy --> API
    SiteGroup --> DAL
    Portal --> DAL
    API --> DAL
    DAL --> Auth
    DAL --> Roles
    DAL --> Tenant
    Portal --> Integrations
    SiteGroup --> Integrations
    Tenant --> DB
    Roles --> DB
    Portal --> Storage
    SiteGroup --> Storage

    style NextApp fill:#eef2fb,stroke:#2f5fbd
    style Supabase fill:#e7f5ef,stroke:#1f8a5f
```

Notas sobre o diagrama:

- `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` está `false` hoje - `/login`, `/portal/*`, `/admin/*` e `/auth/*` respondem 404 de marca em produção. O código existe e funciona; só não está acessível ao público.
- As credenciais reais do Supabase (URL, anon key, service role) e do Resend/Meta WhatsApp **não estão configuradas** nem no ambiente local desta auditoria nem no servidor de produção (`hbuilds/config/.env` na Hostinger só tem `NEXT_PUBLIC_SITE_URL`) - ver `decisions.md` e `architecture.md`.
- Nenhum adapter de ERP/fiscal (Omie.G-Click ou outro) existe - decisão de produto, não lacuna técnica.
