# Decisões - Fase 4

## D1 - Reversão da decisão de produto de 2026-09-16/09-20 ("sem Omie/G-Click")

**Contexto**: o prompt desta fase pede a integração Omie.G-Click como iniciativa ativa. Isso contradiz diretamente `docs/product/roadmap.md`, que registrava desde 2026-09-16 - e reconfirmava na Fase 0 desta mesma sessão, em 2026-09-20 - que nenhuma integração de ERP/fiscal externo seria feita. Havia inclusive um Artifact "Rollout Omie.G-Click" marcado como descontinuado nesta mesma sessão.

**Pergunta feita ao usuário**: manter a decisão (encerrar a Fase 4 como não aplicável), reverter e implementar de verdade, ou só preparar a estrutura sem ativar.

**Decisão do usuário**: reverter e implementar de verdade.

**Ação tomada**: `docs/product/roadmap.md` e `docs/api/integrations.md` atualizados para refletir a reversão, com data e motivo. O bloco D1 do `fase-0/decisions.md` (que documentava a decisão anterior) não foi editado retroativamente - ganhou só um adendo apontando pra este documento, porque aquele texto descreve com precisão o que era verdade antes desta fase.

## D2 - Só "clientes" foi implementado; "tarefas"/"pré-tarefas" ficaram de fora

**Contexto**: o prompt lista "clientes, tarefas e pré-tarefas" como os recursos nativos permitidos, com a regra explícita "somente recursos oficialmente validados" e "não usar endpoint de parceiro sem autorização".

**Decisão**: implementar `upsertClient` (recurso "clientes" da API pública do Omie, com documentação pública amplamente conhecida - envelope `call`/`app_key`/`app_secret`/`param`) e **não** implementar nada para "tarefas"/"pré-tarefas", porque esta sessão não tem documentação pública verificada sobre esses recursos especificamente para o G-Click. Inventar um formato de endpoint/payload sem essa verificação violaria a própria regra do prompt e a regra geral do projeto de nunca inventar integração/API.

**Como avançar**: quando a WJB fornecer a documentação oficial (ou credenciais de uma conta de teste) de "tarefas"/"pré-tarefas", adicionar um novo método à interface `OmieGClickAdapter` seguindo o mesmo padrão de `upsertClient`.

## D3 - Fluxo "BFF" é a própria Server Action, sem endpoint REST paralelo

**Contexto**: o prompt desenha o fluxo como `Dashboard -> WJB BFF -> Authorization -> Integration Service -> OmieGClickAdapter -> Omie API`, com a regra "frontend nunca chama Omie diretamente".

**Decisão**: mesma decisão D3 já tomada na Fase 1 - este projeto usa Server Actions do Next.js como a camada de backend-for-frontend, não uma API REST separada. `saveOmieMapping`/`syncOmieClient`/`setOmieMappingDisabled` cumprem exatamente o papel do "BFF + Authorization + Integration Service" do diagrama: rodam só no servidor, checam sessão/permissão antes de tocar no adapter, e o componente cliente (`OmieMappingPanel`) nunca importa `src/integrations/omie-gclick` diretamente.

## D4 - `conflict` existe no enum, mas nenhuma lógica dispara esse estado

**Contexto**: o prompt exige o enum de status completo, incluindo `conflict`.

**Decisão**: o valor existe no banco (`omie_integration_status`) e no `OmieStatusBadge` (label/tone prontos), mas nenhum código transiciona um mapeamento para `conflict` - não há hoje nenhuma regra definida de "o que é um conflito" entre o cadastro da WJB e o do Omie (nome divergente? CNPJ divergente? dado desatualizado de qual lado?). Implementar uma detecção arbitrária seria inventar uma regra de negócio que só a WJB pode definir. Reconsiderar quando essa regra existir.

## D5 - Adapter Omie não testado contra uma conta real

**Contexto**: nenhuma credencial Omie (`OMIE_APP_KEY`/`OMIE_APP_SECRET`) está disponível nesta sessão - mesma limitação já registrada para o adapter Meta WhatsApp (2026-09-18) e para o projeto Supabase real (herdado da Fase 0).

**Decisão**: implementar o adapter seguindo a convenção pública documentada do Omie ao melhor conhecimento desta sessão, deixando esse gap explícito em `docs/api/integrations.md` e no comentário do próprio `omie.adapter.ts`, em vez de apresentar como "testado e funcionando". Validar contra uma conta real antes de habilitar em produção.

## D6 - CTA do Portal Contábil: link manual, nunca automático

**Contexto**: o prompt exige "CTA seguro para a Visão do Cliente", proibindo iframe por padrão e proibindo inventar SSO.

**Decisão**: `external_portal_url` é um campo que staff preenche manualmente (não há API pública conhecida do G-Click para "descobrir" essa URL automaticamente por tenant). O CTA é um link simples (`<a target="_blank">`), sem iframe, sem tentativa de autenticar o cliente automaticamente no sistema externo. Cumpre a letra e o espírito da regra do prompt sem inventar um mecanismo de SSO que não existe.
