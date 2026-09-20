# Plano de implementação - Fase 5

1. Auditar cada seção do prompt (Empresas, Usuários, Omie, Feature flags, Auditoria, Segurança) contra o console Admin WJB já existente - identificar exatamente o que faltava.
2. Migration `0018_admin_console.sql`: `tenants.status`, correção de `my_tenant_ids()`/`is_tenant_owner()` (achado de segurança real), tabela `feature_flags`.
3. Tipos manuais em `src/types/database.ts` (mesma limitação herdada da Fase 0 - sem projeto Supabase real conectado).
4. `dal.ts::getTenantRole` - checar também `tenants.status` (defesa em profundidade, complementa a RLS).
5. Empresas: `updateTenant`, `suspendTenant`/`reactivateTenant` (`src/actions/tenants.ts`), busca em `/admin/empresas`, `EditTenantForm`, toggle de suspensão em `/admin/empresas/[id]`.
6. Usuários: `updateMemberRole`, `revokeMemberAccess`, `resendMemberInvite` (`src/actions/tenants.ts`), `resendStaffInvite` (`src/actions/staff.ts`), botões correspondentes em `MembersList`/`StaffList`.
7. Omie: `testConnection` no adapter/provider, `testOmieConnection` action, `listOmieMappings`, página `/admin/integracoes`.
8. Feature flags: `src/lib/feature-flags.ts`, `src/actions/feature-flags.ts`, `FeatureFlagsPanel`, wiring real em `uploadDocument`/`notifyTicketOrMessageEvent`/`syncOmieClient`/`OmiePortalCta`.
9. Auditoria: `listAuditLog(filters)`, `listTenantOptions`, formulário de filtro em `/admin/logs`, `actionLabels` expandido.
10. Permissões novas (`tenants.suspend`, `feature_flags.manage`) + permissões mortas da Fase 1 finalmente usadas (`organizations.manage`, `members.manage`).
11. Testes, incluindo privilege escalation explícito (critério de aceite do prompt).
12. Lint, typecheck, test, build.
13. Escrever os 7 artifacts + atualizar `STATUS.md`.

Nenhum item deste plano dependia de credenciais Supabase reais além do que as Fases anteriores já dependiam (mock em testes, mesma limitação herdada).
