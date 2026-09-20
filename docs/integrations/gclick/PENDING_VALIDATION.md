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

## Onde cada pendência aparece no código

- Autenticação/host/token: `src/integrations/omie-gclick/config.ts` (env vars `GCLICK_*`, todas com comentário `TODO_GCLICK_VALIDATION`).
- Schema de cliente (request/response): `src/integrations/omie-gclick/mappers/client.mapper.ts`.
- Schema de tarefa/pré-tarefa: `src/integrations/omie-gclick/mappers/task.mapper.ts`.
- Formato de erro real: `src/integrations/omie-gclick/mappers/error.mapper.ts`.
- Todo método de `src/integrations/omie-gclick/http.provider.ts` - bloqueado até isso ser resolvido.
