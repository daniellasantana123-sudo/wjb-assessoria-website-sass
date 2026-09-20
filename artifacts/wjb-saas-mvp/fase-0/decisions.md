# Decisões e achados - Fase 0

## D1 - Escopo Omie/G-Click permanece descartado

**Contexto**: o prompt desta fase e um documento anterior tratavam a integração Omie.G-Click como iniciativa ativa. `docs/product/roadmap.md` já registrava, desde 2026-09-16, a decisão oposta.

**Decisão do usuário (2026-09-20)**: manter a decisão de 2026-09-16 - sem integração de ERP/fiscal externo. O fluxo de tarefas/documentos/obrigações continua nativo dentro do Portal WJB.

**Ação tomada**: o Artifact "Rollout Omie.G-Click" (criado numa etapa anterior desta mesma sessão) foi marcado como descontinuado (banner visível na própria página, dado gravado em `meta/project_status` no banco do artifact). Esta Fase 0 foi conduzida como auditoria geral da plataforma, sem recorte Omie.

**Atualização (2026-09-20, Fase 4)**: esta decisão foi **revertida** por instrução explícita do usuário ao receber o prompt da Fase 4 - a integração Omie.G-Click passou a ser implementada. Ver `artifacts/wjb-saas-mvp/fase-4/decisions.md` D1 para o registro completo da reversão. Este bloco (D1) fica como está, sem edição retroativa, porque documenta com precisão o que era verdade em 2026-09-20 antes da Fase 4 - é histórico, não o estado atual do produto.

## D2 - Projeto Supabase real existe, mas está desconectado em todos os ambientes acessíveis

**Achado**: `docs/product/roadmap.md` confirma um projeto Supabase real (`wjb-website-app`, sa-east-1) validado de ponta a ponta em 2026-09-16. Porém, nem o checkout local usado nesta auditoria (`.env.local` ausente) nem a produção na Hostinger (`hbuilds/config/.env` só tem `NEXT_PUBLIC_SITE_URL`) têm as credenciais desse projeto configuradas hoje.

**Implicação para a Fase 1**: antes de qualquer trabalho que dependa de banco real (rodar migrations novas, testar RLS, gerar tipos), será necessário obter de volta as credenciais desse projeto Supabase (URL, anon key, service role key) e configurá-las localmente e/ou em produção. Isso não é uma tarefa de código - é uma decisão/ação do usuário (recuperar acesso ao projeto Supabase existente, não criar um novo).

## D3 - `.env.example` e `.github/workflows` estão ausentes apesar de citados como existentes

**Achado**: `playwright.config.ts`, os specs de teste E2E e `docs/architecture/folder-structure.md` citam esses dois artefatos como se existissem. Nenhum dos dois está presente no repositório atual.

**Decisão**: não recriar nesta fase (Fase 0 é só auditoria, sem escrita de código/config de produto). Registrado aqui como pendência real para uma fase futura, com a lista de env vars conhecidas que `.env.example` precisaria documentar: `NEXT_PUBLIC_SITE_URL`, Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `RESEND_API_KEY`/`EMAIL_FROM`, `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_LEAD_TEMPLATE_NAME`, `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED`, `E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_PASSWORD`.

## D4 - Limpeza de arquivos soltos no repositório

**Achado**: `LOG_imapsync/` (logs de uma migração de e-mail feita nesta mesma sessão de trabalho, sem relação com o código-fonte do site) estava na raiz do repositório, não rastreado e fora do `.gitignore`. `.claude/` (config local de skills do Claude Code) também não estava ignorado.

**Ação tomada**: `LOG_imapsync/` movida para fora do repositório (pasta de scratchpad da sessão). Ambas as pastas adicionadas ao `.gitignore`. Nenhum código de produto foi alterado.

## D5 - Nenhuma alteração de produto nesta fase

Conforme pedido pelo prompt da Fase 0, nenhuma feature nova foi implementada. As únicas mudanças no working tree são: `.gitignore` (2 linhas) e a criação da pasta `artifacts/wjb-saas-mvp/`.
