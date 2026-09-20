# Fase 4 - Omie.G-Click MVP

## Objetivo original do prompt

Conectar uma arquitetura Omie.G-Click à fundação SaaS já pronta (tenant isolation, memberships, permissions, secrets server-side): adapter, mapping por organization (nunca direto ao user), enum de status, CTA seguro pro Portal Contábil (sem iframe, sem SSO), API nativa só com recursos oficialmente validados, fluxo Dashboard → BFF → Authorization → Integration Service → Adapter → Omie API, e resiliência (Omie indisponível não pode derrubar login/documentos/Dashboard).

## Contradição de escopo encontrada e resolvida com o usuário

Antes de escrever qualquer código, esta fase encontrou uma contradição direta: `docs/product/roadmap.md` registrava, desde 2026-09-16 e **reconfirmado nesta mesma sessão na Fase 0 (2026-09-20)**, que "nenhuma integração de ERP/fiscal externo" seria feita - o tracker "Rollout Omie.G-Click" de uma etapa anterior desta sessão havia sido marcado como descontinuado por decisão do próprio usuário.

Perguntei explicitamente como proceder. **O usuário escolheu reverter a decisão e implementar de verdade.** Ver `decisions.md` D1 para o registro completo.

## O que foi construído

1. **Mapping por organization** - `omie_client_mappings` (`0017_omie_gclick_integration.sql`), 1 linha por tenant, nunca por usuário. Enum `omie_integration_status` com os 8 estados exatos do prompt.
2. **Adapter Pattern** - `src/integrations/omie-gclick/` (mesma estrutura de `email`/`whatsapp-business`), com adapter no-op quando `OMIE_APP_KEY`/`OMIE_APP_SECRET` não estão configuradas.
3. **Token server-side** - `app_key`/`app_secret` só em variável de ambiente do servidor, nunca chegam ao cliente; adapter roda só dentro de Server Actions (`import "server-only"`).
4. **Painel de staff** em `/admin/empresas/[id]` - configurar mapeamento manualmente, disparar sincronização, ativar/desativar.
5. **CTA no Portal do Cliente** - "Ver no Portal Contábil", link externo em nova aba (nunca iframe, nunca SSO), só aparece com mapeamento `connected`/`synced` e link configurado.
6. **Fluxo Dashboard → BFF → Adapter → Omie** - o "BFF" é a própria Server Action Next.js (mesma decisão D3 da Fase 1: não criar uma camada REST paralela quando Server Actions já cobrem o caso).
7. **Resiliência** - nenhum caminho crítico (login, documentos, Dashboard) chama o adapter; timeout de 10s; adapter nunca lança exceção.
8. **Logs sanitizados** - `audit_log` grava só resultado (`ok`/código de erro), nunca `app_key`/`app_secret`/corpo bruto da resposta.
9. **Permissions** - `integrations.read` (staff + tenant, só leitura) e `integrations.manage` (staff-only, escrita) novas em `src/lib/permissions/permissions.ts`.

## O que ficou deliberadamente fora do escopo desta fase

- **"Tarefas"/"pré-tarefas"** - o prompt cita como recursos da API nativa, mas não há documentação pública verificada nesta sessão sobre esses recursos especificamente do G-Click. Implementar endpoints inventados violaria a regra "somente recursos oficialmente validados" do próprio prompt. Ver `decisions.md` D2.
- **Sincronização automática/periódica** - só sob demanda, acionada por staff. Nenhum cron/webhook foi criado.
- **Detecção de conflito real** - o status `conflict` existe no enum (exigência do prompt) mas nenhuma lógica de comparação Omie×WJB dispara esse estado ainda - não há dado suficiente pra saber o que constitui um "conflito" sem a WJB definir a regra de negócio.

Ver `architecture.md` para o detalhe técnico e `decisions.md` para o racional completo de cada corte de escopo.
