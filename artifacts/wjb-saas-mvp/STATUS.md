# Status - wjb-saas-mvp

## Fase atual

**Fase 6.5 - Omie.G-Click (auditoria + mocks/contratos internos)**: concluída em 2026-09-20, em 2 partes (2 prompts distintos, mesmo número de fase):

- **Parte A - Validação Técnica** (`artifacts/wjb-saas-mvp/fase-6-5/`): auditou a implementação da Fase 4 contra a documentação oficial, confirmou que ela chamava a API do Omie ERP por engano (não a G-Click), e removeu a implementação incorreta.
- **Parte B - Mocks e Contratos Internos** (`docs/integrations/gclick/`): reconstruiu a integração como uma arquitetura Ports & Adapters completa - contrato rico, `MockGClickProvider` funcional (modo padrão), `GClickHttpProvider`-esqueleto (sempre bloqueado), mappers-esqueleto, fixtures, contract tests.

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
| Fase 6.5A - Validação Técnica Omie.G-Click | Concluída | 2026-09-20 |
| Fase 6.5B - Mocks e Contratos Internos Omie.G-Click | Concluída | 2026-09-20 |

## Arquivos alterados na Parte B (mocks e contratos internos)

- `src/integrations/omie-gclick/types.ts` - reescrito: DTOs (`ExternalClient`, `ExternalTask`, ...), `ProviderError`/`ProviderResult`, `ProviderCapabilities`, contrato `OmieGClickAdapter` expandido (`clients.*`, `tasks.*`, `healthCheck()`, `getCapabilities()`).
- `src/integrations/omie-gclick/config.ts` - novo (`GCLICK_MODE`, `GCLICK_REAL_INTEGRATION_ENABLED`, demais placeholders `TODO_GCLICK_VALIDATION`).
- `src/integrations/omie-gclick/fixtures.ts` - novo (dados fictícios).
- `src/integrations/omie-gclick/mock.provider.ts` - novo (`MockGClickProvider`, funcional, em memória, determinístico, cenários simuláveis).
- `src/integrations/omie-gclick/http.provider.ts` - novo (`GClickHttpProvider`, esqueleto, sempre bloqueado).
- `src/integrations/omie-gclick/mappers/{client,task,error}.mapper.ts` - novos (esqueletos, `TODO_GCLICK_VALIDATION`).
- `src/integrations/omie-gclick/provider.ts`, `index.ts` - reescritos (factory por modo).
- `src/actions/omie-gclick.ts` - `syncOmieClient`/`testOmieConnection` migrados pro novo contrato (idempotência create/update explícita).
- `src/components/integrations/omie-status-badge.tsx`, `omie-mapping-panel.tsx`, `src/app/(site)/admin/empresas/[id]/page.tsx`, `src/app/(site)/admin/integracoes/page.tsx` - mostram o modo ativo (mock/sandbox/production), nunca apresentam simulação como conexão real.
- `.env.example` - criado (pendência da Fase 0, fechada nesta fase).
- `.gitignore` - corrigido (`.env`/`.env.production` não estavam cobertos, só `.env*.local`).
- `docs/integrations/gclick/{README,ARCHITECTURE,PENDING_VALIDATION,MOCK_SCENARIOS,GCLICK_MAPPING_PENDING}.md` - novos.
- `docs/api/integrations.md` - seção ERP/Fiscal atualizada.
- 5 arquivos de teste novos (`omie-gclick-contract`, `omie-gclick-mock-provider`, `omie-gclick-http-provider`; `omie-gclick-provider` reescrito) + `omie-gclick-actions.test.ts` atualizado pro novo contrato.

Nenhuma dependência npm nova. Nenhuma migration nova (reaproveitado `omie_client_mappings`/`omie_integration_status` da Fase 4).

## Testes

Lint, typecheck, 201 testes (168 da Parte A + 33 novos/reescritos na Parte B) e build de produção - todos passando.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes - validação de cross-tenant/tenant-suspenso só por leitura de código.
- **Host real e schema técnico da API da G-Click continuam desconhecidos** - documentação Postman inacessível nesta sessão. Ver `docs/integrations/gclick/PENDING_VALIDATION.md`.
- **Modo mock é o padrão quando `GCLICK_MODE` não está configurado** - se a plataforma for ao ar sem essa env var definida, a UI mostra claramente "Modo: Mock" e nunca "Conectado" a um sistema real, mas vale confirmar que ninguém confunda uma sincronização simulada com uma real antes do lançamento público (`NEXT_PUBLIC_SAAS_PUBLIC_ENABLED`).

## Bloqueios

**A sincronização real com o Omie.G-Click continua `BLOCKED_BY_PROVIDER`** - falta a especificação técnica oficial (não só credenciais). A arquitetura está pronta pra receber uma implementação real sem mudança estrutural (só preencher `http.provider.ts` + `mappers/`) assim que a documentação/contato com a Omie confirmar o schema. Ver `docs/integrations/gclick/PENDING_VALIDATION.md` e `artifacts/wjb-saas-mvp/fase-6-5/omie-contact-checklist.md`.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário. Se for a Fase 7 (Production Readiness), recomendo confirmar antes se ela deve prosseguir para o SaaS como um todo (com o Omie.G-Click documentado como pendência isolada, em modo mock, não-crítica) ou se deve esperar a integração real.

## Decisão de escopo importante (revertida na Fase 4, corrigida na Fase 6.5)

A integração Omie.G-Click faz parte do projeto desde 2026-09-20 (Fase 4), revertendo a decisão de 2026-09-16 de não integrar nenhum ERP/fiscal externo. A implementação da Fase 4 usava a API errada (Omie ERP, não G-Click) - corrigido na Fase 6.5A. A Fase 6.5B reconstruiu a integração como uma arquitetura de providers (mock funcional + real bloqueado), pronta para receber a implementação real assim que a especificação técnica da G-Click for confirmada.
