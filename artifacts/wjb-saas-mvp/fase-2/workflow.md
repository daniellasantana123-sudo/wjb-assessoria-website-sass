# Workflow da Fase 2

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 03_FASE_2_AUTH_ONBOARDING_DASHBOARD.md] --> B[Ler artifacts das Fases 0 e 1]
    B --> C{Auditar auth/dashboard existentes antes de codar}
    C --> D[Achado: login/logout/reset/dashboard ja existem e validados]
    D --> E[Achado: status Omie no dashboard - descartado de novo]
    E --> F[Achado: MFA, org switcher, suspensao NAO existem]
    F --> G[Perguntar ao usuario o escopo dos 3 gaps reais]
    G --> H[Usuario decide: MFA so preparar / switcher construir / suspensao os dois]
    H --> I[Implementar MFA: dal.ts + actions/mfa.ts + paginas seguranca]
    I --> J[Implementar switcher: lib/tenant.ts + actions/tenant-context.ts + componente]
    J --> K[Migrar 7 paginas do Portal de getMyPrimaryTenant para getActiveTenant]
    K --> L[Implementar suspensao: migration 0016 + dal.ts + actions/staff.ts e tenants.ts]
    L --> M[Wire UI: StaffList e MembersList]
    M --> N[Escrever testes]
    N --> O[Rodar lint, typecheck, test, build]
    O --> P{Tudo limpo?}
    P -->|Nao| N
    P -->|Sim| Q[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    Q --> R[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - MFA (login com step-up)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant Login as Server Action login()
    participant Page as /portal ou /admin
    participant DAL as requireSession()
    participant MFA as /verificar-mfa

    U->>Login: e-mail + senha
    Login->>Login: signInWithPassword (sessao aal1)
    Login-->>U: redirect /portal (ou /admin)
    U->>Page: GET /portal
    Page->>DAL: requireSession()
    DAL->>DAL: getAuthenticatorAssuranceLevel()
    alt tem fator verificado e ainda em aal1
        DAL-->>U: redirect /verificar-mfa
        U->>MFA: digita codigo de 6 digitos
        MFA->>MFA: challengeAndVerify() -> sessao vira aal2
        MFA-->>U: redirect /portal
    else sem fator ou ja em aal2
        DAL-->>Page: Session
        Page-->>U: renderiza normalmente
    end
```

## Fluxo de dados - Organization switcher

```mermaid
sequenceDiagram
    participant U as Usuario
    participant UI as select na sidebar
    participant Action as switchActiveTenant()
    participant DB as tenant_members (Postgres)
    participant Layout as portal/layout.tsx

    U->>UI: escolhe outra empresa
    UI->>Action: submit (tenantId)
    Action->>Action: requireSession()
    Action->>DB: getMyOrganizations(userId)
    DB-->>Action: empresas reais do usuario
    alt tenantId nao esta na lista
        Action-->>U: nada acontece (ignorado em silencio)
    else tenantId valido
        Action->>Action: cookies().set(active_tenant_id, tenantId)
        Action-->>U: redirect /portal
        U->>Layout: GET /portal
        Layout->>DB: getActiveTenant(userId) revalida de novo
        Layout-->>U: sidebar e paginas mostram a nova empresa
    end
```

## Fluxo de dados - Suspensão

```mermaid
sequenceDiagram
    participant Staff as super_admin
    participant Action as suspendAccount()
    participant DB as profiles (Postgres)
    participant Admin as Supabase Auth Admin API
    participant Pessoa as Conta suspensa
    participant DAL as getSession()

    Staff->>Action: clica "Suspender"
    Action->>DB: update profiles set status = suspended
    Action->>Admin: updateUserById(ban_duration) [best-effort]
    Note over Pessoa,DAL: Da proxima vez que carregar qualquer pagina protegida
    Pessoa->>DAL: getSession()
    DAL->>DB: select status from profiles
    DB-->>DAL: suspended
    DAL-->>Pessoa: null (tratado como deslogado, redireciona /login)
```

## Dependências

- `@supabase/auth-js` (já era dependência transitiva de `@supabase/supabase-js`) - API `mfa.*` e `admin.updateUserById` já existiam, só passaram a ser usadas. Nenhuma dependência nova instalada.
- Tipos verificados direto em `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` e `GoTrueAdminApi.d.ts` antes de escrever código MFA/suspensão - não foram assumidos de memória.

## Testes

- `src/tests/integration/mfa-actions.test.ts` - 11 testes.
- `src/tests/integration/tenant-context.test.ts` - 7 testes.
- `src/tests/integration/account-status-actions.test.ts` - 6 testes.
- `src/tests/integration/me-api.test.ts` e `me-organizations-api.test.ts` - atualizados pra `getActiveTenant`/`getMyOrganizations`.

**Limitação de teste conhecida**: o bloqueio de sessão suspensa dentro de `getSession()`/`getTenantRole()` (ambos memoizados com `cache()` do React) não tem teste automatizado direto - `cache()` memoiza por argumento pra sempre dentro do mesmo módulo, o que quebra a reescrita de mock entre casos de teste no mesmo arquivo. Coberto por revisão manual do código + é a mesma lógica simples já usada pra `is_wjb_staff`. Recomendado como item de teste E2E manual quando as credenciais do Supabase forem reconectadas (ver Fase 0).

## Saídas

- 1 migration nova (`0016_account_status.sql`).
- 5 Server Actions novas de MFA, 1 de troca de empresa, 4 de suspensão/reativação.
- 3 páginas novas (`/verificar-mfa`, `/portal/seguranca`, `/admin/seguranca`).
- 7 páginas do Portal migradas pra `getActiveTenant()`.
- 24 testes novos/atualizados.

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo - fase concluída.
