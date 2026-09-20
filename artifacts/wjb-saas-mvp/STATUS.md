# Status - wjb-saas-mvp

## Fase atual

**Fase 4 - Omie.G-Click MVP**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |
| Fase 3 - Documentos | Concluída | 2026-09-20 |
| Fase 4 - Omie.G-Click MVP | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `supabase/migrations/0017_omie_gclick_integration.sql` - novo (enum `omie_integration_status`, tabela `omie_client_mappings`, RLS).
- `src/types/database.ts` - `OmieIntegrationStatus` e tipos da nova tabela.
- `src/integrations/omie-gclick/{types,provider,omie.adapter,index}.ts` - novo (Adapter Pattern, no-op sem credenciais).
- `src/lib/permissions/permissions.ts` - `integrations.read`/`integrations.manage` novos.
- `src/lib/validation/omie-gclick.ts`, `src/lib/omie-gclick.ts` - novos.
- `src/actions/omie-gclick.ts` - novo (`saveOmieMapping`, `syncOmieClient`, `setOmieMappingDisabled`).
- `src/components/integrations/{omie-status-badge,omie-mapping-panel}.tsx` - novos.
- `src/components/portal/omie-portal-cta.tsx` - novo.
- `src/app/(site)/admin/empresas/[id]/page.tsx` - seção "Integração Omie.G-Click".
- `src/app/portal/page.tsx` - CTA "Ver no Portal Contábil".
- `docs/product/roadmap.md`, `docs/api/integrations.md` - decisão de 2026-09-16/09-20 revertida e documentada.
- `artifacts/wjb-saas-mvp/fase-0/decisions.md` - adendo apontando a reversão (sem editar o texto histórico).
- 2 arquivos de teste novos (`omie-gclick-adapter` unit, `omie-gclick-actions` integration) + 1 teste novo em `permissions.test.ts`.
- `artifacts/wjb-saas-mvp/fase-4/*` - criado.

Nenhuma dependência npm nova.

## Testes

Lint, typecheck, 116 testes (99 anteriores + 17 novos) e build de produção - todos passando. Detalhe completo em `fase-4/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes em todos os ambientes acessíveis - módulo Omie só testado via mock, não contra banco real.
- Adapter Omie não testado contra uma conta Omie real (nenhuma credencial disponível nesta sessão) - ver `fase-4/decisions.md` D5.
- `external_portal_url` é preenchido manualmente por staff, sem verificação cruzada automática.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 4.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (revertida nesta fase)

A integração Omie.G-Click **passou a fazer parte** do projeto em 2026-09-20 (Fase 4), revertendo a decisão de 2026-09-16 (reconfirmada na Fase 0, também em 2026-09-20) de não integrar nenhum ERP/fiscal externo. Só o recurso "clientes" foi implementado - "tarefas"/"pré-tarefas" seguem fora do escopo por falta de documentação pública verificada. Ver `fase-4/decisions.md` D1/D2 para o histórico completo.
