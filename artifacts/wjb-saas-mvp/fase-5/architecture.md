# Arquitetura - Fase 5

## Banco de dados

`supabase/migrations/0018_admin_console.sql`:

- `tenants.status` (reaproveita o enum `account_status` de `0016_account_status.sql` - `active`/`suspended`, nenhum enum novo).
- `my_tenant_ids()` e `is_tenant_owner()` (`CREATE OR REPLACE FUNCTION`, mesma assinatura) - agora filtram `tenant_members.status = 'active'` **e** `tenants.status = 'active'`. Antes só a Fase 2 (app-level, `getTenantRole()`) checava `tenant_members.status`; a RLS de toda tabela dependente (`documents`, `obligations`, `tickets`, `messages`, `notifications`, `omie_client_mappings`) nunca checava nada disso. Ver `decisions.md` D1.
- `feature_flags` (`key` pk, `enabled`, `updated_by`, `updated_at`) - leitura liberada a qualquer autenticado, escrita só `is_super_admin()`. Semeada com as 3 keys que têm ponto de checagem real: `omie_gclick`, `documents`, `notifications`.

## Empresas

- `updateTenant` (`src/actions/tenants.ts`) - edita nome/CNPJ. Usa `organizations.manage` (Fase 1, existia sem nenhuma checagem real até agora - mesmo padrão de "finalmente usar uma permissão morta" da Fase 3 com `documents.delete`).
- `suspendTenant`/`reactivateTenant` - `tenants.status`. Exclusivo de `tenants.suspend` (permissão nova, só `super_admin`) - mesmo nível de severidade de `suspendAccount` (staff) em `src/actions/staff.ts`. Corta acesso de TODOS os membros de uma vez, de verdade (RLS), não só um efeito de UI.
- `/admin/empresas` ganhou busca (`?q=`, `ilike` em nome/CNPJ) e badge "Suspensa"; `/admin/empresas/[id]` ganhou `EditTenantForm` e o toggle suspender/reativar (só aparece pra quem tem `tenants.suspend`).

## Usuários

- `updateMemberRole`/`revokeMemberAccess` (`src/actions/tenants.ts`) - usam `members.manage` (Fase 1, também morta até agora). `revokeMemberAccess` apaga a linha de `tenant_members` (diferente de `suspendMember`, que só marca `status`).
- `resendMemberInvite` (mesma regra de acesso de `inviteMember`: staff ou `owner` da própria empresa) e `resendStaffInvite` (super_admin) reaproveitam `admin.auth.admin.inviteUserByEmail` - mesma chamada do convite original.
- `MembersList` e `StaffList` ganharam os botões correspondentes, todos como `<form action={async () => {"use server"; ...}}>` inline (mesmo padrão de suspender/reativar já usado nos dois componentes - sem JS de cliente extra).

## Omie.G-Click - visão entre empresas

- `OmieGClickAdapter.testConnection()` (novo método) - chama `ListarClientes` com 1 registro por página, só pra confirmar que `app_key`/`app_secret` autenticam, sem criar/alterar nada. Adapter no-op retorna `{ok:false, error:"no-provider"}`, mesmo contrato de `upsertClient`.
- `listOmieMappings()` (`src/lib/omie-gclick.ts`) - todas as linhas de `omie_client_mappings` com o nome do tenant, ordenadas por última sincronização.
- `/admin/integracoes` - nova página: badge de credenciais configuradas (`isOmieConfigured()`, só lê `process.env`, nunca expõe o valor), botão "Testar conexão" (`OmieConnectionTest`, client component), lista de mapeamentos linkando pra `/admin/empresas/[id]` (o painel de configurar/sincronizar POR empresa continua lá, criado na Fase 4 - esta página não duplica aquele formulário).

## Feature flags

- `src/lib/feature-flags.ts` - `isFeatureEnabled(key)` (memoizado por request via `cache()`, cai em `true` se a linha não existir - nunca desliga uma feature por acidente/falha de leitura), `listFeatureFlags()`.
- `src/actions/feature-flags.ts` - `setFeatureFlag(key, enabled)`, exclusivo de `feature_flags.manage` (permissão nova, só `super_admin`).
- Pontos de checagem real (só 3, ver `decisions.md` D2):
  - `uploadDocument` (`src/actions/documents.ts`) - bloqueia só o envio; leitura/download continuam.
  - `notifyTicketOrMessageEvent` (`src/lib/notifications.ts`) - `return` antecipado, nem notificação in-app nem e-mail saem.
  - `syncOmieClient` (`src/actions/omie-gclick.ts`) - bloqueia sincronização nova; `OmiePortalCta` (Portal do Cliente) também lê a flag e some o CTA mesmo com mapeamento `connected`/`synced` por tenant.
- `/admin/integracoes` - `FeatureFlagsPanel` (client component), toggle visível a todo staff, botão de ação só pra quem tem `feature_flags.manage`.

## Auditoria

- `listAuditLog(filters)` (`src/lib/audit-log.ts`) - `tenantId` (`eq`), `action` (`eq`), `dateFrom`/`dateTo` (`gte`/`lte` em `created_at`), `actorQuery` (2 buscas `ilike` separadas em `profiles.full_name`/`profiles.email` - nunca `.or()` com string interpolada, pra não quebrar a sintaxe do filtro do PostgREST com `,`/`(`/`)` no termo digitado - depois filtra `audit_log` por `actor_id in (...)`).
- `listTenantOptions()` - lista enxuta pro `<select>` de filtro.
- `/admin/logs` - formulário GET (`?tenantId=&actorQuery=&action=&dateFrom=&dateTo=`, sem JS de cliente, mesmo padrão de `/portal/documentos`), `actionLabels` expandido com todas as ações novas desta fase.

## Segurança / RBAC

- "wjb_admin" (citado no prompt) não existe no schema - tratado como `super_admin` (ver `decisions.md` D5). Ações super_admin-only: `tenants.suspend`, `feature_flags.manage`, `staff.manage` (já existia), `resendStaffInvite`. Ações staff-only (qualquer papel): `organizations.manage`, `members.manage`, `integrations.manage` (já existia).
- Toda ação nova grava `audit_log` (`tenant.updated`, `tenant.suspended`, `tenant.reactivated`, `tenant_member.role_changed`, `tenant_member.access_revoked`, `tenant_member.invite_resent`, `staff.invite_resent`, `integration.omie_connection_tested`, `feature_flag.updated`).
- Testes de privilege escalation (`src/tests/integration/admin-console-actions.test.ts`) confirmam que `contador`/`atendimento` NUNCA conseguem suspender empresa, mexer em feature flags ou reenviar convite de staff.
