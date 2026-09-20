# Checklist de aceite - Fase 5

## Empresas

- [x] Listar - já existia.
- [x] Buscar - novo, `?q=` por nome/CNPJ em `/admin/empresas`.
- [x] Criar - já existia.
- [x] Editar - novo, `updateTenant` + `EditTenantForm`.
- [x] Suspender - novo, `tenants.status` + correção real de RLS (`my_tenant_ids()`).
- [x] Reativar - novo.

## Usuários

- [x] Listar - já existia (staff via `StaffList`; tenant_members via `MembersList`).
- [x] Convidar - já existia (`inviteStaffMember`/`inviteMember`).
- [x] Reenviar convite - novo (`resendStaffInvite`/`resendMemberInvite`).
- [x] Alterar role - já existia pra staff (`updateStaffRole`); novo pra tenant_members (`updateMemberRole`).
- [x] Suspender membership - já existia (Fase 2, `suspendMember`).
- [x] Revogar acesso - já existia pra staff (`revokeStaffAccess`); novo pra tenant_members (`revokeMemberAccess`, hard delete).

## Omie

- [x] Status - já existia por empresa (Fase 4); novo: visão entre empresas em `/admin/integracoes`.
- [x] Mapping - já existia (Fase 4).
- [x] Testar conexão - novo (`testConnection`/`testOmieConnection`).
- [x] Sincronizar - já existia (Fase 4).
- [x] Visualizar último erro sanitizado - já existia por empresa; agora também na visão geral.

## Feature flags

- [x] Omie - `omie_gclick`, checado em `syncOmieClient` e `OmiePortalCta`.
- [x] Documentos - `documents`, checado em `uploadDocument`.
- [x] Notificações - `notifications`, checado em `notifyTicketOrMessageEvent`.
- [x] Demais features do MVP - deliberadamente não criadas sem ponto de checagem real. Ver `decisions.md` D2.

## Auditoria

- [x] Filtro por empresa - `?tenantId=`.
- [x] Filtro por usuário - `?actorQuery=` (nome ou e-mail).
- [x] Filtro por ação - `?action=`.
- [x] Filtro por período - `?dateFrom=&dateTo=`.

## Segurança

- [x] Somente super_admin/permissions específicas - `wjb_admin` tratado como `super_admin` (schema não tem esse papel, ver `decisions.md` D5).
- [x] Toda ação administrativa gera audit log - confirmado por teste em cada action nova.

## Critérios de aceite do prompt

- [x] Empresa criada via UI - já existia.
- [x] Convite via UI - já existia.
- [x] Role com auditoria - staff (já existia) e tenant_members (novo).
- [x] Suspensão de membership - já existia (Fase 2).
- [x] Mapping Omie - já existia (Fase 4).
- [x] Feature flags - novo.
- [x] Audit viewer - já existia, agora com filtros.
- [x] Privilege escalation testado - `src/tests/integration/admin-console-actions.test.ts` confirma que `contador`/`atendimento` nunca conseguem suspender empresa, alterar feature flags ou reenviar convite de staff.

## Verificação técnica

- [x] Lint limpo.
- [x] Typecheck limpo.
- [x] 147 testes passando (31 novos desta fase).
- [x] Build limpo, incluindo a rota nova `/admin/integracoes`.
