# Fase 0 - Auditoria do estado atual

## Objetivo

Auditar o repositório `wjb-assessoria-website-sass` e registrar o que já existe na Plataforma SaaS (V2) antes de qualquer nova implementação. Esta fase não altera código de produto - só lê, executa comandos de verificação e documenta.

## Contexto importante desta rodada

O prompt original desta fase pedia para "identificar o que já foi criado para Omie" (adapter, HTTP client, endpoints, UI). Antes de escrever este relatório, confirmei com o usuário uma contradição real entre documentos:

- `docs/product/roadmap.md` já registra, desde 2026-09-16, a decisão de **não** integrar nenhum ERP/fiscal externo (Omie.G-Click incluído) - o fluxo de tarefas/documentos/obrigações é 100% nativo dentro do Portal WJB.
- Um documento anterior tratava a integração Omie.G-Click como iniciativa ativa, e chegou a existir um diagnóstico e um tracker (Artifact) específicos para ela.

O usuário confirmou em 2026-09-20 que a decisão de 2026-09-16 continua valendo: **sem Omie/G-Click**. O tracker anterior foi marcado como descontinuado. Esta auditoria, portanto, é uma auditoria geral da Plataforma SaaS - a seção "Estado da integração Omie" existe abaixo só para constar (não existe nenhum código Omie no repositório, por decisão, não por lacuna).

## Arquivos desta fase

- `README.md` - este arquivo.
- `workflow.md` - diagramas Mermaid do processo de auditoria e da arquitetura atual.
- `architecture.md` - inventário factual completo (stack, auth, banco, tenant, RBAC, rotas, integrações, CI/CD, observabilidade, secrets).
- `implementation-plan.md` - nenhuma implementação nesta fase; lista de candidatos para a Fase 1, pendente de decisão do usuário.
- `decisions.md` - decisões e achados registrados durante a auditoria.
- `checklist.md` - critérios de aceite da Fase 0, com status.
- `test-report.md` - saída real de lint, typecheck, testes e build.
- `phase-handoff.md` - resumo de handoff para a próxima fase.

Ver também `artifacts/wjb-saas-mvp/STATUS.md` (status consolidado do projeto).
