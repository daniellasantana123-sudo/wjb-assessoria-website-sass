# Auditoria técnica - Omie.G-Click (Fase 6.5)

Executado em 2026-09-20. Fontes primárias consultadas (via WebFetch, nesta sessão):

- https://ajuda.omie.com.br/pt-BR/articles/15209409-omie-g-click-api
- https://ajuda.omie.com.br/pt-BR/articles/15209392-omie-g-click-como-funcionam-as-integracoes-da-g-click
- https://ajuda.omie.com.br/pt-BR/articles/15210640-omie-g-click-como-seu-cliente-ira-acessar-o-portal-visao-do-cliente
- https://ajuda.omie.com.br/pt-BR/collections/19642324-omie-g-click-integracoes-api
- https://ajuda.omie.com.br/pt-BR/collections/19642278-omie-g-click-nosso-portal-visao-do-cliente
- https://documenter.getpostman.com/view/12417251/UV5TFeha - **inacessível nesta sessão**: a página é renderizada via JavaScript (SPA) e o `WebFetch` desta sessão só recebe o HTML inicial (título "API Omie.G-Click", sem conteúdo). É a única fonte que teria a especificação técnica completa (host, métodos HTTP, schemas de request/response) - sua ausência é o motivo central da classificação final desta auditoria.

## Resumo executivo

```text
Adapter correto?                  NÃO (corrigido nesta fase - ver Gap G1)
API confirmada?                   PARCIAL (produto certo identificado; schema técnico não acessível)
Auth confirmada?                  PARCIAL (modelo geral confirmado - token via "gerar credenciais"; parâmetros exatos não confirmados)
Credenciais corretas?             NÃO (nomes antigos removidos; nomes corretos ainda não confirmados)
Endpoint clientes confirmado?     PARCIAL (recurso existe e é público; schema técnico não confirmado)
Mapping tenant seguro?            SIM
Portal CTA validado?              SIM (corrigido nesta fase - ver Gap G4)
Teste real executado?             NÃO (BLOCKED_BY_CREDENTIALS e BLOCKED_BY_PROVIDER)
```

## Parte 1 - Inventário da implementação

| Componente | Arquivo/Local | Função | Status | Observação |
|---|---|---|---|---|
| `OmieGClickAdapter` (interface) | `src/integrations/omie-gclick/types.ts` | Contrato do Adapter Pattern | validated | Provider-agnóstica, não precisa mudar |
| `omie.adapter.ts` (implementação real) | removido nesta fase | Chamadas HTTP reais | **incorrect** | Chamava a API do Omie ERP (`app.omie.com.br`), não a G-Click - ver Gap G1 |
| `provider.ts` (`getOmieGClickAdapter`/`isOmieConfigured`) | `src/integrations/omie-gclick/provider.ts` | Factory do adapter | validated (corrigido) | Agora sempre devolve o adapter no-op; `isOmieConfigured()` sempre `false` |
| `GCLICK_CLIENT_PORTAL_URL` (novo) | `src/integrations/omie-gclick/constants.ts` | URL fixa do Portal Visão do Cliente | validated | Confirmada via documentação oficial nesta fase |
| `omie_client_mappings` (tabela) | `supabase/migrations/0017_omie_gclick_integration.sql` | Mapping 1:1 tenant->cliente externo | validated | Nunca por usuário, `tenant_id` único |
| RLS de `omie_client_mappings` | mesma migration + `0018` (`my_tenant_ids()`) | Isolamento entre empresas | validated | Herda a correção de status (tenant/membership suspenso) da Fase 5 |
| `saveOmieMapping`/`setOmieMappingDisabled` | `src/actions/omie-gclick.ts` | Configuração manual (staff) | validated | Autorização server-side correta; não depende do adapter real |
| `syncOmieClient`/`testOmieConnection` | `src/actions/omie-gclick.ts` | Aciona o adapter | validated (autorização) / **blocked** (resultado, por natureza) | Sempre retornam erro sanitizado até o adapter real existir |
| `OmieMappingPanel` | `src/components/integrations/omie-mapping-panel.tsx` | UI staff (por empresa) | validated (corrigido) | Copy ajustada para não afirmar nomes de campo do Omie ERP |
| `OmieStatusBadge` | `src/components/integrations/omie-status-badge.tsx` | UI | validated | Sem dependência da API |
| `OmieConnectionTest` | `src/components/integrations/omie-connection-test.tsx` | UI (testar conexão) | validated | Chama a action, que hoje sempre retorna bloqueado |
| `OmiePortalCta` | `src/components/portal/omie-portal-cta.tsx` | CTA no Portal do Cliente | validated (corrigido) | Ver Gap G4 |
| `/admin/integracoes` | `src/app/(site)/admin/integracoes/page.tsx` | Visão geral entre empresas | validated (corrigido) | Badge/copy atualizados para refletir o bloqueio real |
| Feature flag `omie_gclick` | `src/lib/feature-flags.ts`, `0018_admin_console.sql` | Kill switch | validated | Já testado (Fase 5) |
| Permissions `integrations.read`/`integrations.manage` | `src/lib/permissions/permissions.ts` | RBAC | validated | Staff-only para escrita, leitura liberada a membro do próprio tenant |
| `notifyIntegrationStatus` | `src/lib/notifications.ts` | Notificação de falha de sync | validated | In-app apenas, exclui quem já viu o resultado |
| `audit_log` (`integration.omie_*`) | várias actions | Auditoria | validated | Nunca grava credencial/payload bruto |
| Testes (`omie-gclick-actions.test.ts`, `omie-gclick-provider.test.ts`) | `src/tests/` | Cobertura automatizada | validated (atualizados) | `omie-gclick-adapter.test.ts` (testava a implementação errada) removido |
| `OMIE_APP_KEY`/`OMIE_APP_SECRET` (env vars) | removidas nesta fase | Credenciais | **incorrect** (removidas) | Nomes e modelo pertenciam à API do Omie ERP, não à G-Click |
| Tarefas/pré-tarefas | não implementado | Recurso adicional | not_confirmed / partner_only | Ver Parte 7 |

## Parte 2 - Qual API está sendo usada

**Confirmado via documentação oficial**: a Omie.G-Click API é um produto separado da API do Omie ERP ("Omie G-Click API is a separate product API (distinct from general Omie ERP)"). A implementação da Fase 4 usava o envelope `call`/`app_key`/`app_secret`/`param` contra `https://app.omie.com.br/api/v1/geral/clientes/` com chamadas `IncluirCliente`/`AlterarCliente`/`ListarClientes` - **esse é o padrão documentado da API do Omie ERP**, não da G-Click.

A documentação oficial da G-Click descreve um modelo diferente: um endpoint de "Gerar credenciais" que produz "o Token que será usado em todos os demais endpoints obrigatoriamente" - ou seja, um fluxo de emissão de token separado, não um par de chaves reenviado a cada requisição.

**Gap G1 (critical, corrigido)**: o Adapter implementava a API errada. Ver `decisions.md` D1 e `api-validation.md` para o detalhe completo.

## Parte 3/4 - Credenciais e autenticação

Ver `credentials-model.md` para o detalhe completo. Resumo: `OMIE_APP_KEY`/`OMIE_APP_SECRET` pertenciam ao modelo do Omie ERP e foram removidas. O nome/formato exato das credenciais da G-Click (Client ID/Secret? e-mail+senha? chave emitida por suporte?) não está confirmado nesta sessão - nenhuma variável nova foi inventada em substituição.

## Parte 5 - Mapping por tenant

Validado, sem alteração necessária:

- Mapping é 1:1 por `tenant_id` (`unique` na coluna) - nunca por usuário.
- Nenhuma Server Action aceita um `tenant_id` de formulário/cliente sem autorização - `saveOmieMapping`/`syncOmieClient`/`setOmieMappingDisabled`/`testOmieConnection` são todas `requireStaffSession()` + `hasPermission("integrations.manage")`, e staff já enxerga todas as empresas por design (RLS `is_staff()`) - não há um caminho onde um MEMBRO de uma empresa possa mutar o mapeamento de outra.
- Leitura (`getOmieMapping`, usada pelo Portal do Cliente) é escopada por `tenant_id` explícito + RLS (`omie_mappings_select_staff_or_tenant_member`, via `my_tenant_ids()`).
- `my_tenant_ids()` (corrigida na Fase 5) exclui tenants/memberships com `status = 'suspended'` - uma empresa suspensa ou um vínculo suspenso perde acesso de leitura ao próprio mapeamento automaticamente, sem nenhuma mudança nesta fase.
- `getActiveTenant()` continua sendo a única fonte da organização ativa no Portal (`src/app/portal/page.tsx`).

Testes de cross-tenant/tenant-suspenso/membership-suspensa dependem da RLS em produção (banco real) - a mesma limitação herdada desde a Fase 0 (nenhum projeto Supabase real conectado nesta sessão) se aplica aqui; a lógica foi revisada por leitura de código e é idêntica ao padrão já usado (e testado onde possível) em `documents`/`obligations`.

## Parte 6 - Endpoint de clientes

A documentação oficial da G-Click lista, como recurso público: "Criar cliente", "Alterar cliente", "Listar clientes", "Buscar clientes", "Buscar clienteId" (+ "Grupo"/"Visibilidade" complementares). O RECURSO existe e é conceitualmente equivalente ao que `upsertClient` tentava fazer - mas os nomes exatos de endpoint/parâmetros usados na implementação removida (`IncluirCliente`/`AlterarCliente`/`codigo_cliente_omie`/`codigo_cliente_integracao`) são termos do Omie ERP, não confirmados como os mesmos da G-Click. Sem acesso ao Postman técnico, reimplementar corretamente exigiria adivinhar o schema - não fizemos isso.

**Classificação**: `not_confirmed` (schema técnico), recurso em si `public_documented` (existe e é mencionado publicamente, sem indicação de restrição a parceiros).

## Parte 7 - Tarefas e pré-tarefas

| Recurso | Classificação | Ação |
|---|---|---|
| Listar tarefas | `not_confirmed` | Não implementado - schema técnico não acessível |
| Criar pré-tarefa | `not_confirmed` | Não implementado - schema técnico não acessível |
| Responder atividade | `partner_only` | Não implementado - exige autorização comercial da Omie |
| Criar pré-tarefa com tag | `partner_only` | Não implementado - exige autorização comercial da Omie |

Nenhum destes 4 recursos foi implementado nesta ou em fases anteriores - consistente com a decisão original da Fase 4 (D2), agora reforçada com a classificação explícita acima.

## Parte 8 - Recursos exclusivos para parceiros

```text
Recursos que exigem contato com a Omie
```

| Recurso | Motivo | Benefício pra WJB | Bloqueio atual | O que pedir à Omie |
|---|---|---|---|---|
| Responder atividade | `partner_only` (documentado) | Automatizar resposta a atividades do G-Click a partir do Portal WJB | Sem autorização de parceiro | Confirmar processo de homologação/parceria |
| Criar pré-tarefa com tag | `partner_only` (documentado) | Criar tarefas com metadado de tag direto do SaaS WJB | Sem autorização de parceiro | Idem |
| Especificação técnica completa (Postman) | Conteúdo não acessível via fetch automatizado nesta sessão | Implementar `upsertClient`/`testConnection` de verdade | Acesso à documentação completa | Pedir a documentação técnica em formato acessível (PDF/export) ou confirmar credenciais de acesso ao Postman workspace |

## Parte 9 - Portal Visão do Cliente

**Confirmado via documentação oficial**: login único e compartilhado em `https://visao.gclick.com.br/login` - cada cliente usa credenciais próprias (usuário externo criado pela contabilidade, senha enviada por e-mail pelo próprio G-Click). Não há SSO nem deep link documentado publicamente.

**Gap G4 (medium, corrigido)**: `OmiePortalCta` exigia que staff preenchesse `external_portal_url` manualmente para o CTA aparecer, como se cada empresa tivesse uma URL diferente. Corrigido: `GCLICK_CLIENT_PORTAL_URL` (constante, valor confirmado acima) agora é o padrão quando staff não configura um link próprio (a personalização visual do portal é documentada como possível, então o campo manual continua existindo como override, não foi removido).

Nenhum SSO, scraping, iframe ou automação de login foi criado ou cogitado - conforme as regras globais do prompt.

## Parte 10/11 - Adapter Pattern e resiliência

Válidos, sem alteração de arquitetura: Portal/Admin nunca chamam a G-Click diretamente, só via Server Action -> `getOmieGClickAdapter()`. Como o adapter agora é sempre o no-op, TODOS os cenários de indisponibilidade (timeout, DNS, `401`/`403`/`404`/`429`/`500`/`502`/`503`, payload inválido, token expirado) são trivialmente cobertos: não há nenhuma chamada de rede que possa falhar de forma inesperada. Login, Dashboard, Documentos, Notificações e Admin nunca dependeram do adapter Omie (validado desde a Fase 4/5, reconfirmado nesta auditoria por leitura de código - nenhum desses caminhos importa `src/integrations/omie-gclick`).

## Parte 12 - Segurança

- Busca no repositório por `OMIE_`/`GCLICK_`/`client_secret`/`access_token`/`app_secret`/`Authorization`/`Bearer`: nenhum valor real encontrado, só nomes de variável/comentários (ver `credentials-model.md`).
- Nenhum arquivo `.env*` existe no repositório (confirmado via `find`/`git log`).
- `audit_log` de eventos Omie grava só `{ok, error}` (código de erro curto), nunca payload/credencial.
- Nenhum secret é lido no lado do cliente - `provider.ts`/o antigo `omie.adapter.ts` sempre tiveram `import "server-only"`.

## Parte 13 - Feature flag

`omie_gclick` (Fase 5) continua funcionando como kill switch - `syncOmieClient` a checa antes de qualquer coisa. Comportamento validado por leitura de código para todos os cenários pedidos (flag global desligada, tenant sem integração, tenant conectado, tenant suspenso via RLS, mapping inválido, provider indisponível - hoje sempre indisponível).

## Parte 14/15 - Testes

Ver `test-report.md`. Nenhum teste real contra a API foi executado - `BLOCKED_BY_CREDENTIALS` e `BLOCKED_BY_PROVIDER` (nem a especificação técnica está confirmada, então nem um smoke test de baixo risco pode ser desenhado com precisão ainda). Plano de smoke test preparado em `phase-handoff.md`.

## Gaps encontrados

| ID | Severidade | Gap | Evidência | Correção necessária |
|---|---|---|---|---|
| G1 | critical | Adapter chamava a API do Omie ERP (`app.omie.com.br`), não a G-Click | `omie.adapter.ts` (removido) usava envelope `call`/`app_key`/`app_secret`/`param`; documentação oficial confirma G-Click é produto/API separado | **Corrigida nesta fase** - implementação removida, adapter sempre no-op |
| G2 | high | `OMIE_APP_KEY`/`OMIE_APP_SECRET` não representam credenciais da G-Click | Nomes herdados do modelo Omie ERP; G-Click documenta um endpoint de "gerar credenciais" -> Token | **Corrigida nesta fase** - variáveis removidas; nomes corretos ainda pendentes de confirmação (ver `credentials-model.md`) |
| G3 | medium | Endpoint de clientes usava nomes de operação (`IncluirCliente` etc.) não confirmados para G-Click | Documentação G-Click usa "Criar/Alterar/Listar/Buscar clientes", termos diferentes | Mitigada pela remoção (G1); reimplementar exige documentação técnica completa |
| G4 | medium | CTA do Portal exigia URL manual por tenant, mas o portal real usa uma URL única e fixa | Artigo oficial confirma `https://visao.gclick.com.br/login` compartilhada | **Corrigida nesta fase** - `GCLICK_CLIENT_PORTAL_URL` como fallback |
| G5 | informational | "Tarefas"/"pré-tarefas" sem schema técnico confirmado; 2 sub-recursos são `partner_only` | Documentação oficial | Nenhuma ação - já estava fora de escopo, agora com classificação explícita |
| G6 | informational | Especificação técnica completa (Postman) inacessível nesta sessão | Página JS-renderizada, `WebFetch` só retornou o título | Registrar como limitação - ver `omie-contact-checklist.md` |

## Decisão

```text
BLOCKED_BY_PROVIDER
```

**Justificativa**: todos os gaps `critical`/`high` conhecidos (G1, G2) foram corrigidos - o Adapter não chama mais a API errada, nenhuma credencial mal-nomeada permanece, nenhum secret foi exposto, o isolamento entre tenants é seguro, e nenhuma falha do provider pode afetar login/Dashboard/Documentos. Não existe hoje nenhum item da lista de bloqueio explícita do prompt (`wrong API` corrigido, `wrong authentication model` corrigido, `cross-tenant vulnerability` não encontrada, `secret exposure` não encontrada, `unknown production behavior` não encontrada).

A classificação não é `VALIDATED` porque a integração, de fato, não sincroniza nada com o G-Click real ainda - e não é `BLOCKED_BY_CREDENTIALS` porque falta mais que credenciais: falta a especificação técnica (schema de request/response, formato exato do token) que só existe na documentação Postman, inacessível nesta sessão. Ver `phase-handoff.md` para a leitura explícita do gate da Parte 22 sobre o que isso significa para a Fase 7.
