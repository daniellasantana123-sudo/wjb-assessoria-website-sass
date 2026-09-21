# Pendências de validação oficial - Omie.G-Click

Tudo abaixo depende de confirmação da documentação técnica oficial (Postman: `documenter.getpostman.com/view/12417251/UV5TFeha`, inacessível nesta sessão - conteúdo renderizado via JavaScript) ou de contato direto com a Omie/G-Click. Nada aqui foi assumido ou inventado no código - ver `TODO_GCLICK_VALIDATION` nos arquivos-fonte.

```text
[ ] Base URL oficial
[ ] Endpoint de autenticação
[ ] Request de autenticação
[ ] Response de autenticação
[ ] Header de autenticação
[ ] Expiração do token
[ ] Renovação do token
[ ] Rate limit
[ ] Sandbox
[ ] Criar cliente
[ ] Alterar cliente
[ ] Listar clientes
[ ] Buscar cliente
[ ] Buscar clienteId
[ ] Campo de external reference
[ ] Grupos
[ ] Visibilidade
[ ] Listar tarefas
[ ] Criar pré-tarefa
[ ] Partner only
[ ] Responder atividade
[ ] Criar pré-tarefa com tag
[ ] Portal Visão do Cliente
```

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
