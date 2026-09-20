# Validação da API - Omie.G-Click (Fase 6.5)

## Omie ERP API x Omie.G-Click API

Confirmado via documentação oficial (ajuda.omie.com.br, artigo "Omie.G-Click: API"): são **produtos/APIs separados**. A Omie adquiriu/incorporou o G-Click, mas a API de integração da G-Click não é a mesma API de negócios do Omie ERP.

| | Omie ERP API (usada por engano na Fase 4) | Omie.G-Click API (correta para esta integração) |
|---|---|---|
| Host usado na implementação removida | `app.omie.com.br` | Não confirmado (só existe na doc Postman) |
| Autenticação | `app_key`/`app_secret` reenviados em todo request, no corpo | Endpoint de "Gerar credenciais" -> Token, usado nos demais endpoints |
| Chamadas de cliente usadas na implementação removida | `IncluirCliente`/`AlterarCliente`/`ListarClientes` | "Criar cliente"/"Alterar cliente"/"Listar clientes"/"Buscar clientes"/"Buscar clienteId" (nomes conceituais da doc, schema técnico não confirmado) |
| Formato de erro usado na implementação removida | Sempre HTTP 200, erro em `faultstring`/`faultcode` no corpo | Não documentado nesta sessão |

**Conclusão**: o adapter da Fase 4 implementou corretamente um envelope de API real e bem documentado - só que da API errada para o propósito desta integração. Não houve invenção de payload naquela fase (era um formato real, só mal-aplicado); a implementação foi removida nesta fase por essa razão.

## Endpoint de clientes (Parte 6 do prompt)

Recursos confirmados como existentes e públicos (não `partner_only`) na documentação oficial da G-Click:

- Criar cliente
- Alterar cliente
- Listar clientes
- Buscar clientes
- Buscar clienteId
- Grupo (complementar)
- Visibilidade (complementar)

Não confirmados nesta sessão (dependem da doc Postman, inacessível):

- Método HTTP de cada endpoint
- Path exato de cada endpoint
- Nome e formato exato dos campos de request (razão social? nome fantasia? CNPJ/CPF? campo de correlação com sistema externo, equivalente ao `codigo_cliente_integracao` do Omie ERP?)
- Nome e formato exato dos campos de response (existe um "id do cliente no G-Click" análogo ao `codigo_cliente_omie`?)
- Paginação
- Tratamento de cliente inexistente/duplicidade
- Rate limits

**Não adaptamos a documentação para caber no código nem o código para caber numa suposição de schema** - por isso `upsertClient` hoje não faz nenhuma chamada real, só resolve com `blocked-by-provider`.

## Tarefas e pré-tarefas (Parte 7 do prompt)

| Recurso | Classificação | Fonte |
|---|---|---|
| Listar tarefas | `not_confirmed` | Citado na doc oficial, sem restrição explícita de acesso, mas sem schema técnico confirmado |
| Criar pré-tarefa | `not_confirmed` | Idem |
| Responder atividade | `partner_only` | Doc oficial: "exclusivos para parceiros" |
| Criar pré-tarefa com tag | `partner_only` | Doc oficial: "exclusivos para parceiros" |

Nenhum dos 4 foi implementado. Os 2 `partner_only` não devem ser implementados sem autorização comercial formal da Omie (regra explícita do prompt e regra geral do projeto).

## Portal Visão do Cliente (Parte 9 do prompt)

Confirmado via documentação oficial (artigo "Omie.G-Click: como seu cliente irá acessar o Portal Visão do Cliente"):

- URL de login: `https://visao.gclick.com.br/login` - **única, compartilhada entre todas as contas G-Click**, não uma URL por cliente/empresa.
- Autenticação: usuário externo (criado pela contabilidade dentro do G-Click) + senha enviada por e-mail pelo próprio G-Click.
- Sem SSO documentado, sem deep link via API documentado.
- Personalização visual do portal existe (branding), mas isso não significa uma URL diferente por cliente - é customização de aparência dentro da mesma plataforma.

Aplicado ao código: `GCLICK_CLIENT_PORTAL_URL` (`src/integrations/omie-gclick/constants.ts`) como fallback do CTA "Ver no Portal Contábil".

## Limitação registrada (não inferida, não inventada)

A especificação técnica completa (base URL/host real da API, HTTP methods, request/response JSON schemas, nome exato do header de autenticação, formato de erro) só existe na documentação Postman oficial (`documenter.getpostman.com/view/12417251/UV5TFeha`), que é uma SPA renderizada via JavaScript - o `WebFetch` desta sessão só recebe o HTML inicial (título da página, sem o conteúdo real). Nenhuma tentativa foi feita de adivinhar esse conteúdo. Ver `omie-contact-checklist.md` para como obter isso.
