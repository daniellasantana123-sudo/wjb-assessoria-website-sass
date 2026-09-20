# Fase 6.5 - Validação Técnica Omie.G-Click

## Objetivo original do prompt

Auditar tecnicamente a integração Omie.G-Click (construída na Fase 4) contra a documentação oficial antes de liberar a entrada na Fase 7 - Production Readiness. Auditar primeiro, corrigir só o que estiver comprovadamente incorreto, nunca inventar comportamento/payload/endpoint.

## Resultado em uma frase

**A implementação da Fase 4 chamava a API errada** - a API do Omie ERP (`app.omie.com.br`, envelope `app_key`/`app_secret`), não a Omie.G-Click API (produto separado, confirmado via documentação oficial). A implementação incorreta foi removida; a integração está agora em estado seguro (`BLOCKED_BY_PROVIDER`: nunca chama rede, nunca finge sucesso), com toda a arquitetura ao redor (mapping, RLS, permissões, resiliência, feature flag, auditoria, CTA do Portal) validada e preservada.

## O que foi feito

1. **Auditoria primeiro** - leitura completa da implementação existente + 5 páginas da documentação oficial da Omie.G-Click (`ajuda.omie.com.br`) via `WebFetch`. A especificação técnica completa (Postman) não pôde ser lida (conteúdo renderizado via JavaScript).
2. **Diagnóstico** - `audit-report.md`, com inventário completo, gaps classificados por severidade, e decisão final `BLOCKED_BY_PROVIDER`.
3. **Correções aplicadas** (só as comprovadas, ver `decisions.md`):
   - `src/integrations/omie-gclick/omie.adapter.ts` (chamava a API errada) - **removido**.
   - `getOmieGClickAdapter()` - agora sempre devolve o adapter no-op, nunca chama rede.
   - `OMIE_APP_KEY`/`OMIE_APP_SECRET` - removidas (nomes do modelo errado); nenhum nome novo foi inventado em substituição.
   - CTA "Ver no Portal Contábil" - passou a usar a URL real e fixa do login (`https://visao.gclick.com.br/login`, confirmada via documentação oficial) como padrão, em vez de depender de staff preencher um campo por empresa.
   - Copy da UI (painel admin, página de integrações) corrigida para não afirmar nomes de campo/credencial do Omie ERP como se fossem da G-Click.
4. **O que NÃO foi feito** (por falta de confirmação, não por falta de esforço): reimplementar `upsertClient`/`testConnection` contra a G-Click real (sem a especificação técnica, seria inventar payload); "tarefas"/"pré-tarefas" continuam fora de escopo, com 2 sub-recursos agora explicitamente classificados como `partner_only`.

Ver `audit-report.md` para o diagnóstico completo, `api-validation.md`/`credentials-model.md` para o detalhe técnico, e `omie-contact-checklist.md` para o que a WJB precisa perguntar à Omie antes de reativar a integração real.
