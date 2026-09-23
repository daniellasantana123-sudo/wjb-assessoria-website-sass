# Pendências de validação oficial - Omie.G-Click

> **RESOLVIDO em 2026-09-23.** A documentação técnica oficial foi obtida. O Postman documenter é uma SPA (por isso as tentativas anteriores só traziam o título), mas o front dele consome uma API pública que devolve a coleção inteira em JSON:
>
> ```
> https://documenter.gw.postman.com/api/collections/12417251/UV5TFeha
> ```
>
> A coleção completa (~120 KB, sem nenhuma credencial - as variáveis vêm como `{{client_id}}`/`{{client_secret}}`) está salva em [`postman-collection.json`](./postman-collection.json) como fonte de verdade versionada. **Ao reabrir qualquer dúvida de schema, consultar esse arquivo antes de supor qualquer coisa.**

```text
[x] Base URL oficial ............. https://api.gclick.com.br
[x] Endpoint de autenticação ..... POST /oauth/token
[x] Request de autenticação ...... form-urlencoded: client_id, client_secret, grant_type=client_credentials
[x] Response de autenticação ..... { access_token, token_type: "bearer", expires_in, scope }
[x] Header de autenticação ....... Authorization: Bearer <access_token>
[x] Expiração do token ........... expires_in = 86399s (~24h)
[x] Renovação do token ........... repetir o POST /oauth/token (não há refresh_token)
[ ] Rate limit ................... não documentado na coleção
[ ] Sandbox ...................... não há host de sandbox documentado - só o host de produção
[x] Criar cliente ................ POST /clientes
[x] Alterar cliente .............. PUT /clientes/{id}
[x] Listar clientes .............. GET /clientes
[x] Buscar cliente ............... GET /clientes/search?texto=
[x] Buscar clienteId ............. GET /clientes/{id}
[x] Campo de external reference .. `integracao` (máx. 255) + `sistema` (máx. 200)
[x] Grupos ....................... GET /grupos, GET /grupos/busca?termo=
[x] Visibilidade ................. GET /visibilidades, GET /visibilidades/busca?termo=
[x] Listar tarefas ............... GET /tarefas?categoria=&dataAcaoInicio=
[x] Criar pré-tarefa ............. POST /v2/tarefas/preTarefas
[x] Partner only ................. /departamentos, /processos, /atividades/resposta, /tarefas/preTarefas (v1 com tag)
[x] Responder atividade .......... POST /atividades/resposta (partner_only)
[x] Criar pré-tarefa com tag ..... POST /tarefas/preTarefas (partner_only)
[ ] Portal Visão do Cliente ...... segue sem SSO/deep link documentado
```

## Campos obrigatórios confirmados

**`POST /clientes`** (obrigatórios marcados com `*` na documentação):
`tipoInscricao*` (CNPJ|CPF|CEI|SREG), `inscricao*` (máx. 18), `nome*` (máx. 64), `apelido*` (máx. 64), `tipo*` (FIXO|EVENTUAL), `visibilidadeIds*` (lista de ids válidos), `dataInicio*` (yyyy-MM-dd).
Opcionais: `statusComplementarId`, `grupoIds`, `sistema`, `integracao`, `nascimento`, `honorario`, `observacao`, `endereco`, `telefones`, `emails`.

**`POST /v2/tarefas/preTarefas`**: `departamentoId*`, `assunto*`, `andamento*`. Opcionais: `inscricoes`, `clienteId`, `responsavelId`, `processoId`, `fluxoId`, `arquivos`, `convidadosIds`.

## O que depende da conta da WJB (não dá pra inferir da documentação)

- **`visibilidadeIds`** - obrigatório pra criar cliente. Listar com `GET /visibilidades` depois de autenticar e escolher o(s) id(s) que a WJB usa.
- **`grupoIds`** - opcional, mas provavelmente desejável. Listar com `GET /grupos`.
- **`departamentoId`** - obrigatório pra criar pré-tarefa. **`GET /departamentos` é partner_only**, então esse id precisa sair da própria tela do G-Click.
- **`tipo`** (FIXO|EVENTUAL) e **`dataInicio`** - regra de negócio da WJB, não da API.

Por isso esses valores entram como **configuração** (`GCLICK_*` em `config.ts`), nunca hardcoded.

## O que já foi confirmado (auditoria anterior, `artifacts/wjb-saas-mvp/fase-6-5/`)

- A Omie.G-Click API é um produto/API separado da API do Omie ERP.
- Autenticação é via um endpoint de "Gerar credenciais" que devolve um Token - não um par `app_key`/`app_secret` reenviado a cada request (esse era o modelo, errado, usado na Fase 4).
- Recursos de clientes existem publicamente: Criar/Alterar/Listar/Buscar cliente, Buscar clienteId, Grupo, Visibilidade.
- Recursos de tarefas existem publicamente: Listar tarefas, Criar pré-tarefa.
- `partner_only` confirmado para: Responder atividade, Criar pré-tarefa com tag.
- Portal Visão do Cliente: login único em `https://visao.gclick.com.br/login`, sem SSO/deep link documentado.

## Novo em 2026-09-21 - resposta do suporte da Omie + confirmação de terceiro

O usuário recebeu um e-mail do suporte da Omie com o caminho exato até a área de API do G-Click (prints em anexo, não commitados aqui - dado do painel de uma conta real):

- Navegação real dentro do G-Click: **Configurações > Integrações & API > aba "API" > "Aplicações"**. A tela mostra um link "Clique aqui para conferir a documentação da nossa API", que aponta pro mesmo Postman já conhecido (`documenter.getpostman.com/view/12417251/UV5TFeha`).
- Autenticação: botão **"+ Criar uma Aplicação"** gera as credenciais.
- **Confirmado via fonte terceira independente** (artigo de suporte da Jettax 360, uma empresa que já integra de verdade com o G-Click): ao criar a aplicação, os 2 valores gerados se chamam literalmente **"ID de cliente"** e **"Segredo de cliente"** - ou seja, o modelo é **Client ID / Client Secret**, confirmando (não mais só como candidato) os nomes já usados como placeholder em `GCLICK_CLIENT_ID`/`GCLICK_CLIENT_SECRET` desde a Fase 6.5.

**O que isso NÃO resolve ainda**: nenhum item da lista de checkbox acima pode ser marcado como concluído - ainda faltam o endpoint exato de troca de credenciais por token, o nome do campo de resposta (token/access_token/Token), o header usado nas chamadas seguintes, o host real da API, e o schema de cada endpoint de cliente/tarefa. A documentação Postman (`documenter.getpostman.com/...`) continua carregando só o título quando acessada por ferramenta automatizada nesta sessão (SPA renderizada via JavaScript) - isso não mudou.

**Próximo passo concreto**: pedir pro usuário criar a aplicação no G-Click (gera Client ID/Secret reais - NUNCA colar esses valores no chat, só em `.env.local`, que não é versionado) e, secão por seção, tirar print ou copiar o texto da documentação Postman (autenticação primeiro, depois clientes) pra eu conseguir ler o schema real sem inventar nada.

## Onde cada pendência aparece no código

- Autenticação/host/token: `src/integrations/omie-gclick/config.ts` (env vars `GCLICK_*`, todas com comentário `TODO_GCLICK_VALIDATION`).
- Schema de cliente (request/response): `src/integrations/omie-gclick/mappers/client.mapper.ts`.
- Schema de tarefa/pré-tarefa: `src/integrations/omie-gclick/mappers/task.mapper.ts`.
- Formato de erro real: `src/integrations/omie-gclick/mappers/error.mapper.ts`.
- Todo método de `src/integrations/omie-gclick/http.provider.ts` - bloqueado até isso ser resolvido.
