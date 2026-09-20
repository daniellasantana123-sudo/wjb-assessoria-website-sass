# Fase 5 - Console Admin WJB

## Objetivo original do prompt

Permitir operar o SaaS sem editar banco manualmente: Empresas (listar/buscar/criar/editar/suspender/reativar), Usuários (listar/convidar/reenviar convite/alterar role/suspender membership/revogar acesso), Omie (status/mapping/testar conexão/sincronizar/último erro sanitizado), Feature flags (Omie, documentos, notificações, demais features do MVP), Auditoria (filtros por empresa/usuário/ação/período), Segurança (só super_admin/wjb_admin/permissions específicas, toda ação gera audit log).

## O que já existia (não recriado)

Boa parte do console Admin WJB já existia desde a SAAS FASE 4 (2026-09-16) e as Fases 1-4 do wjb-saas-mvp: `/admin/empresas` (listar/criar), `/admin/usuarios` (listar/convidar/alterar role/suspender/revogar staff), `/admin/logs` (lista simples, sem filtro), painel Omie por empresa em `/admin/empresas/[id]` (Fase 4: status, mapeamento, sincronizar). Ver `architecture.md` para o detalhe completo do que já estava pronto por seção do prompt.

## Achado de segurança real ao implementar "suspender empresa"

`my_tenant_ids()` (função usada pela RLS de `documents`/`obligations`/`tickets`/`messages`/`notifications`/`omie_client_mappings`) nunca checava `tenant_members.status`, mesmo depois da Fase 2 ter introduzido a suspensão de membership - a checagem só existia no nível de aplicação (`getTenantRole()`). Corrigido nesta fase junto da suspensão de empresa (mesma migration) - ver `decisions.md` D1.

## O que foi construído nesta fase

1. **Empresas**: busca por nome/CNPJ (`?q=`), editar (`updateTenant`), suspender/reativar a EMPRESA inteira (`tenants.status`, novo).
2. **Usuários (tenant_members)**: trocar papel (`updateMemberRole`), revogar acesso de vez (`revokeMemberAccess`, diferente de suspender), reenviar convite (`resendMemberInvite`). Staff (`resendStaffInvite`) ganhou o mesmo reenvio.
3. **Omie.G-Click**: `/admin/integracoes` - visão entre empresas de todos os mapeamentos, "testar conexão" (novo método `testConnection` no adapter, sem tocar em nenhum tenant específico).
4. **Feature flags**: `feature_flags` (tabela nova), 3 kill switches com ponto de checagem real (`omie_gclick`, `documents`, `notifications`) - painel em `/admin/integracoes`, só super_admin edita.
5. **Auditoria**: filtros por empresa, usuário (nome/e-mail), ação e período em `/admin/logs`.
6. **Segurança**: toda ação nova gera `audit_log`; testes de privilege escalation cobrindo as ações mais sensíveis (suspender empresa, feature flags, reenviar convite interno).

## "wjb_admin" não existe no schema - tratado como `super_admin`

O prompt cita "somente super_admin, wjb_admin". Este projeto só tem 3 papéis de staff (`super_admin`, `contador`, `atendimento`) - não existe nem nunca existiu `wjb_admin`. Tratado como o mesmo papel que já chamamos `super_admin` (o papel administrativo máximo já existente), em vez de criar um papel paralelo sem nenhuma distinção real de permissões. Ver `decisions.md` D5.

Ver `architecture.md` para o detalhe técnico e `decisions.md` para o racional completo de cada corte de escopo.
