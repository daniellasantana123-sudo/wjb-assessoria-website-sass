# Status - wjb-saas-mvp

## Fase atual

**Fase 6.5 - Validação Técnica Omie.G-Click**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |
| Fase 3 - Documentos | Concluída | 2026-09-20 |
| Fase 4 - Omie.G-Click MVP | Concluída | 2026-09-20 |
| Fase 5 - Console Admin WJB | Concluída | 2026-09-20 |
| Fase 6 - Notificações e suporte | Concluída | 2026-09-20 |
| Fase 6.5 - Validação Técnica Omie.G-Click | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `src/integrations/omie-gclick/omie.adapter.ts` - **removido** (chamava a API do Omie ERP, confirmado incorreto para a G-Click).
- `src/integrations/omie-gclick/provider.ts` - reescrito: sempre devolve o adapter no-op, `isOmieConfigured()` sempre `false`.
- `src/integrations/omie-gclick/constants.ts` - novo (`GCLICK_CLIENT_PORTAL_URL`, URL real do login do Portal Visão do Cliente).
- `src/integrations/omie-gclick/types.ts`, `index.ts` - comentários/exports atualizados.
- `src/components/portal/omie-portal-cta.tsx` - usa a URL real como fallback.
- `src/components/integrations/omie-mapping-panel.tsx`, `src/app/(site)/admin/integracoes/page.tsx` - copy corrigida (sem afirmar nomes de campo/credencial do Omie ERP).
- `docs/api/integrations.md` - seção ERP/Fiscal atualizada com o achado e a correção.
- `artifacts/wjb-saas-mvp/fase-4/decisions.md`, `fase-5/phase-handoff.md` - adendos apontando pra esta fase (sem reescrever histórico).
- `src/tests/unit/omie-gclick-adapter.test.ts` - removido (testava a implementação incorreta).
- `src/tests/unit/omie-gclick-provider.test.ts` - novo (3 testes, confirma estado seguro).
- `artifacts/wjb-saas-mvp/fase-6-5/*` - criado (11 arquivos, incluindo `audit-report.md`, `api-validation.md`, `credentials-model.md`, `omie-contact-checklist.md`).

Nenhuma dependência npm nova. Nenhuma migration nova.

## Testes

Lint, typecheck, 168 testes (170 anteriores - 5 removidos + 3 novos) e build de produção - todos passando. Detalhe completo em `fase-6-5/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes - validação de cross-tenant/tenant-suspenso desta fase foi só por leitura de código.
- **Host real e schema técnico da API da G-Click continuam desconhecidos** - a documentação técnica completa (Postman) não pôde ser lida nesta sessão (conteúdo renderizado via JavaScript). Ver `fase-6-5/omie-contact-checklist.md`.
- Nenhum nome de variável de ambiente foi definido para credenciais reais da G-Click ainda (deliberado - ver `fase-6-5/decisions.md` D2).

## Bloqueios

**A sincronização real com o Omie.G-Click está `BLOCKED_BY_PROVIDER`** - falta a especificação técnica oficial (não só credenciais). Não é um bloqueio de código (a arquitetura está pronta para receber uma implementação real sem mudança estrutural), é um bloqueio de acesso à documentação/contato com a Omie. Ver `fase-6-5/audit-report.md` e `fase-6-5/phase-handoff.md` (seção "Leitura do gate da Parte 22") para a leitura explícita de como isso afeta a entrada na Fase 7.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário. Se for a Fase 7 (Production Readiness), recomendo confirmar antes se ela deve prosseguir para o SaaS como um todo (com o Omie.G-Click documentado como pendência isolada e não-crítica) ou se deve esperar a integração real - ver `fase-6-5/phase-handoff.md`.

## Decisão de escopo importante (revertida na Fase 4, corrigida na Fase 6.5)

A integração Omie.G-Click faz parte do projeto desde 2026-09-20 (Fase 4), revertendo a decisão de 2026-09-16 de não integrar nenhum ERP/fiscal externo. A implementação da Fase 4, porém, usava a API errada (Omie ERP, não G-Click) - corrigido na Fase 6.5 removendo a implementação incorreta. A integração continua arquiteturalmente pronta (mapping, RLS, permissões, feature flag, UI), mas sem nenhuma sincronização real até a especificação técnica da G-Click ser confirmada.
