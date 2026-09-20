# Arquitetura - Fase 1

## Mapeamento: domínio pedido -> o que já existe

| Domínio pedido | Implementação real (já existente, não alterada) | Status |
|---|---|---|
| `users` | `auth.users` (Supabase Auth) + `public.profiles` (`id, full_name, email, is_wjb_staff, staff_role`) | Satisfeito |
| `organizations` | `public.tenants` (`id, name, cnpj, created_by, created_at`) | Satisfeito |
| `memberships` | `public.tenant_members` (`tenant_id, profile_id, role: owner\|member`) | Satisfeito |
| `roles` | `profiles.staff_role` (`super_admin\|contador\|atendimento`) para staff; `tenant_members.role` (`owner\|member`) para cliente | Satisfeito |
| `permissions` | **Gap real fechado nesta fase** - `src/lib/permissions/permissions.ts` | Novo |
| `invitations` | `supabase.auth.admin.inviteUserByEmail()` (fluxo nativo, e-mail de convite real do Supabase Auth), acionado por `src/actions/tenants.ts::inviteMember` e `src/actions/staff.ts::inviteStaffMember` | Satisfeito |
| `sessions` | Sessão JWT nativa do Supabase Auth via cookies SSR (`@supabase/ssr`), renovada em `src/proxy.ts` | Satisfeito |
| `audit_logs` | `public.audit_log` (`actor_id, tenant_id, action, entity, entity_id, metadata jsonb`) | Satisfeito |
| `feature-flags` | `src/config/features.ts` + `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` | Satisfeito |
| `AuthContext` | `src/lib/auth/dal.ts::Session` + `getTenantRole()` - já deriva tudo da sessão do servidor, nunca do browser | Satisfeito |
| `GET /api/me` | **Gap real fechado nesta fase** - `src/app/api/me/route.ts` | Novo |
| Demais endpoints REST | Não criados - duplicariam Server Actions já existentes e testadas (ver `decisions.md` D3) | Deliberadamente fora de escopo |

## Sistema de permissões (`src/lib/permissions/permissions.ts`)

Camada nova, aditiva - não substitui `src/lib/permissions/roles.ts`, que continua sendo o que as Server Actions/páginas existentes usam para autorizar de verdade. A nova camada mapeia papel -> lista de `Permission` (string), pensada para código novo que prefira checar `hasPermission(session, "documents.upload")` em vez de reimplementar lógica de papel.

Os mapas refletem o que a aplicação **realmente aplica hoje**, confirmado lendo o código de cada Server Action (não o que seria "ideal"):

- `contador` e `atendimento` têm exatamente as mesmas permissões hoje, porque nenhuma Server Action distingue os dois (`canManageObligations()` existe em `roles.ts` mas não é chamada em lugar nenhum - código morto, confirmado via `grep`). Só `super_admin` tem `staff.manage` (`isSuperAdmin()`, usada em `src/actions/staff.ts` e `/admin/usuarios`).
- `owner` e `member` (cliente) têm as mesmas permissões de documentos/obrigações/tickets/mensagens - confirmado em `src/actions/documents.ts` ("qualquer membro da empresa... pode enviar"). Só `owner` tem `members.invite` (confirmado em `src/actions/tenants.ts::inviteMember`).

## Endpoints novos

### `GET /api/me`

Retorna o `AuthContext` da sessão atual: `userId, email, fullName, isWjbStaff, staffRole, organizationId, role, permissions`. Staff sempre recebe `organizationId: null, role: null` (não é `tenant_member` de nenhuma empresa - acessa via RLS de `is_staff()`). 401 sem sessão.

### `GET /api/me/organizations`

Lista as empresas vinculadas ao usuário logado (todas, não só a primeira - diferente de `getMyPrimaryTenant()`, usado no Portal hoje). Staff recebe lista vazia sem consultar o banco. Pensado para um futuro seletor multi-empresa, sem exigir mudança de back-end quando ele existir.

## Gate de publicação

`/api/me` foi adicionado à lista `GATED_PREFIXES` de `src/proxy.ts` - enquanto `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` não for `"true"`, essa rota responde 404 de marca, mesmo padrão já aplicado a `/login`, `/portal`, `/admin`. `/api/me/organizations` fica coberto pelo mesmo prefixo (`/api/me` cobre subrotas).

## Tenant isolation e IDOR

Nenhuma rota nova aceita `tenantId`/`organizationId` vindo do cliente - `organizationId` em `/api/me` é sempre derivado de `getMyPrimaryTenant(session.userId)` no servidor, e `/api/me/organizations` sempre filtra por `profile_id = session.userId`. Mesmo padrão já usado no resto do app (`requireTenantAccess`, corrigido pelo pentest de 2026-09-17 documentado no roadmap).
