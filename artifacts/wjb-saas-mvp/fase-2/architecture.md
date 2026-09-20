# Arquitetura - Fase 2

## 1. MFA (TOTP)

**Arquivos**: `src/actions/mfa.ts` (novo), `src/lib/auth/dal.ts` (editado), `src/components/auth/mfa-challenge-form.tsx` (novo), `src/components/security/mfa-settings.tsx` (novo), `src/app/(site)/(auth)/verificar-mfa/page.tsx` (novo), `src/app/portal/seguranca/page.tsx` (novo), `src/app/(site)/admin/seguranca/page.tsx` (novo).

- API usada: `supabase.auth.mfa.{enroll,challengeAndVerify,unenroll,listFactors,getAuthenticatorAssuranceLevel}` - nativa do Supabase Auth (`@supabase/auth-js`), sem tabela/provider próprio. Tipos conferidos direto em `node_modules/@supabase/auth-js` antes de escrever qualquer linha (não assumidos de memória).
- `requireSession()` (DAL) ganhou uma checagem de AAL (Authenticator Assurance Level): se a pessoa tem um fator TOTP verificado mas a sessão ainda está em `aal1`, redireciona pra `/verificar-mfa`. Memoizado com `cache()`, mesma convenção de `getSession()`.
- `/verificar-mfa` **não** usa `requireSession()` (leria a sessão via `getSession()` direto) - usá-la causaria loop, já que é justamente o redirect que `requireSession()` dispara.
- Não é obrigatório pra ninguém - `nextLevel` só vira `aal2` quando existe um fator verificado, então quem nunca ativou (100% dos usuários hoje) nunca é afetado.
- Enrollment: `enrollTotpFactor()` retorna QR code (SVG data URI, direto do Supabase) + secret; `verifyTotpEnrollment()` confirma com o código de 6 dígitos (`challengeAndVerify`, que já promove a sessão pra `aal2` ao confirmar).

## 2. Organization switcher

**Arquivos**: `src/lib/tenant.ts` (editado - `getMyPrimaryTenant` removida, `getMyOrganizations`/`getActiveTenant` novas), `src/actions/tenant-context.ts` (novo), `src/components/portal/organization-switcher.tsx` (novo), `src/app/portal/layout.tsx` + 7 páginas do Portal (editadas).

- `getActiveTenant(userId)`: lê o cookie `active_tenant_id`, mas **sempre revalida contra `getMyOrganizations(userId)`** (query real em `tenant_members`) antes de confiar nele - um cookie adulterado no browser nunca dá acesso a uma empresa da qual a pessoa não é membro de fato. Sem cookie válido, cai na primeira empresa (mesmo comportamento de antes do switcher existir).
- `switchActiveTenant(formData)`: mesma validação server-side - só grava o cookie se `tenantId` estiver na lista real de empresas do usuário; senão, ignora em silêncio (sem revelar se aquele id existe).
- UI (`OrganizationSwitcher`): `<select>` nativo (reaproveita `src/components/ui/select.tsx`, sem componente novo de dropdown) - só aparece com 2+ empresas; com 1 ou 0, mostra o nome fixo (comportamento idêntico ao que já existia).
- Todas as 7 páginas do Portal (`page.tsx`, `calendario`, `guias`, `documentos`, `suporte`, `mensagens`, `obrigacoes`, `usuarios`) + o layout migraram de `getMyPrimaryTenant()` pra `getActiveTenant()` - sem essa migração, o switcher trocaria o cookie mas nenhuma página perceberia.

## 3. Suspensão de conta e de vínculo

**Arquivos**: `supabase/migrations/0016_account_status.sql` (novo), `src/types/database.ts` (editado), `src/lib/auth/dal.ts` (editado), `src/actions/staff.ts` + `src/actions/tenants.ts` (editados), `src/components/staff/staff-list.tsx` + `src/components/tenant/members-list.tsx` (editados).

- **`profiles.status`** (`account_status` enum, `active`/`suspended`) - bloqueia o login inteiro. Checado em `getSession()`: se suspenso, retorna `null` (tratado como sem sessão) - a PRÓXIMA página carregada já reflete isso, sem depender de o JWT expirar.
- **`tenant_members.status`** - bloqueia só o acesso a uma empresa específica, sem mexer na conta. Checado em `getTenantRole(tenantId)`.
- **`supabase.auth.admin.updateUserById(id, { ban_duration })`** chamado como camada extra (best-effort) ao suspender/reativar - usa o mecanismo de ban nativo do Supabase Auth, mas o bloqueio de verdade (imediato, garantido) é a checagem de `status` acima, não esta chamada. Documentado explicitamente no código pra não criar uma falsa sensação de que o ban por si só é suficiente.
- Nenhuma RLS nova - `profiles_update_super_admin` (0011) e `tenant_members_update_staff_only` (0006) já cobrem update de qualquer coluna, incluindo a nova `status` (RLS é row-level, não column-level).
- UI: badge "Suspenso" + botão Suspender/Reativar em `/admin/usuarios` (conta inteira, exclusivo `super_admin`) e em `/admin/empresas/[id]` (só aquele vínculo, qualquer staff - `MembersList` ganhou prop `canManage`, `false` por padrão, então `/portal/usuarios` que reaproveita o mesmo componente não ganha os controles).

## Tenant isolation e IDOR

- `switchActiveTenant`/`getActiveTenant` nunca aceitam uma empresa que não esteja na lista real de membros do usuário - mesmo padrão de tenant isolation já usado no resto do projeto (corrigido pelo pentest de 2026-09-17, documentado na Fase 0).
- `suspendMember`/`reactivateMember` são staff-only (não expostos a `owner`), reduzindo a superfície de quem pode bloquear o acesso de outra pessoa.
