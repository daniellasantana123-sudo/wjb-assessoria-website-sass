# Status - wjb-saas-mvp

## Fase atual

**Fase 2 - Auth, onboarding e Dashboard**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `supabase/migrations/0016_account_status.sql` - novo (`profiles.status`, `tenant_members.status`).
- `src/types/database.ts` - `AccountStatus`, colunas novas nos tipos de `profiles`/`tenant_members`.
- `src/lib/auth/dal.ts` - AAL check (MFA) em `requireSession()`; checagem de `status` suspenso em `getSession()`/`getTenantRole()`.
- `src/lib/tenant.ts` - `getMyPrimaryTenant()` removida (ficou sem uso); `getMyOrganizations()`/`getActiveTenant()` novas.
- `src/actions/mfa.ts` - novo (enroll/verify/unenroll/challenge de MFA).
- `src/actions/tenant-context.ts` - novo (`switchActiveTenant`).
- `src/actions/staff.ts` - `suspendAccount`/`reactivateAccount` novas.
- `src/actions/tenants.ts` - `suspendMember`/`reactivateMember` novas.
- `src/components/auth/mfa-challenge-form.tsx`, `src/components/security/mfa-settings.tsx`, `src/components/portal/organization-switcher.tsx` - novos.
- `src/components/staff/staff-list.tsx`, `src/components/tenant/members-list.tsx` - editados (badge + botão de suspender/reativar).
- `src/app/(site)/(auth)/verificar-mfa/page.tsx`, `src/app/portal/seguranca/page.tsx`, `src/app/(site)/admin/seguranca/page.tsx` - novos.
- `src/app/portal/layout.tsx` + 7 páginas do Portal - migradas de `getMyPrimaryTenant` pra `getActiveTenant`.
- `src/app/api/me/route.ts`, `src/app/api/me/organizations/route.ts` - atualizados pra usar `getActiveTenant`/`getMyOrganizations`.
- `src/proxy.ts` - `/verificar-mfa` adicionado ao gate do SaaS.
- 3 arquivos de teste novos (`mfa-actions`, `tenant-context`, `account-status-actions`), 2 atualizados (`me-api`, `me-organizations-api`).
- `artifacts/wjb-saas-mvp/fase-2/*` - criado.

## Testes

Lint, typecheck, 80 testes (56 anteriores + 24 novos) e build de produção - todos passando. Detalhe completo em `fase-2/test-report.md`. Uma limitação de teste conhecida (checagem de suspensão em `getSession()`, não coberta por teste automatizado por causa de `cache()` do React) - ver `fase-2/decisions.md` D6.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real (`wjb-website-app`) ausentes em todos os ambientes acessíveis - MFA, switcher e suspensão só foram testados via mock, não contra banco real.
- A migration `0016` precisa ser aplicada antes de qualquer deploy que use este código (`getSession()` agora seleciona a coluna `status`).
- `ban_duration` (revogação de sessão) é best-effort - o mecanismo real de bloqueio é a checagem de `status`, não a chamada ao Supabase Auth Admin API.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 2.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (mantida desde a Fase 0)

A integração Omie.G-Click **não faz parte** deste projeto - decisão de produto de 2026-09-16, reconfirmada em 2026-09-20.
