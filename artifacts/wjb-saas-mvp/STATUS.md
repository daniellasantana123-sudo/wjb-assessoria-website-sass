# Status - wjb-saas-mvp

## Fase atual

**Fase 5 - Console Admin WJB**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |
| Fase 3 - Documentos | Concluída | 2026-09-20 |
| Fase 4 - Omie.G-Click MVP | Concluída | 2026-09-20 |
| Fase 5 - Console Admin WJB | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `supabase/migrations/0018_admin_console.sql` - novo (`tenants.status`, fix de `my_tenant_ids()`/`is_tenant_owner()`, tabela `feature_flags`).
- `src/types/database.ts` - `tenants.status`, `feature_flags`, `FeatureFlagKey`.
- `src/lib/auth/dal.ts` - `getTenantRole` também checa `tenants.status`.
- `src/lib/feature-flags.ts`, `src/actions/feature-flags.ts` - novos.
- `src/actions/tenants.ts` - `updateTenant`, `suspendTenant`, `reactivateTenant`, `updateMemberRole`, `revokeMemberAccess`, `resendMemberInvite`.
- `src/actions/staff.ts` - `resendStaffInvite`.
- `src/actions/documents.ts`, `src/lib/notifications.ts`, `src/actions/omie-gclick.ts` - gate de feature flag.
- `src/integrations/omie-gclick/{types,provider,omie.adapter,index}.ts` - `testConnection`/`isOmieConfigured` novos.
- `src/lib/omie-gclick.ts` - `listOmieMappings`.
- `src/lib/audit-log.ts` - `listAuditLog(filters)`, `listTenantOptions`.
- `src/lib/permissions/permissions.ts` - `tenants.suspend`, `feature_flags.manage` novas.
- `src/components/admin/{edit-tenant-form,feature-flags-panel}.tsx`, `src/components/integrations/omie-connection-test.tsx` - novos.
- `src/components/tenant/members-list.tsx`, `src/components/staff/staff-list.tsx` - botões novos (trocar papel, revogar, reenviar convite).
- `src/app/(site)/admin/{empresas/page.tsx,empresas/[id]/page.tsx,logs/page.tsx,page.tsx}` - busca, edição, suspensão, filtros, nav card.
- `src/app/(site)/admin/integracoes/page.tsx` - novo.
- `src/app/portal/page.tsx` - `OmiePortalCta` também lê a feature flag.
- 3 arquivos de teste novos (`admin-console-actions`, `feature-flags`, `audit-log`) + testes adicionados em 3 arquivos existentes.
- `artifacts/wjb-saas-mvp/fase-5/*` - criado.

Nenhuma dependência npm nova.

## Testes

Lint, typecheck, 147 testes (116 anteriores + 31 novos) e build de produção - todos passando. Detalhe completo em `fase-5/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes em todos os ambientes acessíveis - console admin só testado via mock, não contra banco real.
- Herdado da Fase 4: credenciais Omie (`OMIE_APP_KEY`/`OMIE_APP_SECRET`) ausentes - `testConnection` nunca chamado contra a API real.
- `resendMemberInvite`/`resendStaffInvite` não testados contra o caso real "convite já aceito" - ver `fase-5/decisions.md` D7.
- Suspender uma empresa é imediato e sem nenhum aviso automático ao cliente (e-mail/notificação) - ver `fase-5/phase-handoff.md`.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 5.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (revertida na Fase 4, mantida)

A integração Omie.G-Click faz parte do projeto desde 2026-09-20 (Fase 4), revertendo a decisão de 2026-09-16 de não integrar nenhum ERP/fiscal externo. Só o recurso "clientes" (+ "testar conexão", Fase 5) foi implementado - "tarefas"/"pré-tarefas" seguem fora do escopo por falta de documentação pública verificada.
