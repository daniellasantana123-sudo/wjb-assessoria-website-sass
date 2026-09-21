# Modelo de credenciais - Omie.G-Click (Fase 6.5)

## O que existia antes desta fase

`OMIE_APP_KEY`/`OMIE_APP_SECRET` (lidas em `src/integrations/omie-gclick/provider.ts`, nunca configuradas em nenhum ambiente real desta sessão). Modelo: par de chaves estático, reenviado no corpo de toda requisição - **esse é o modelo de autenticação do Omie ERP**, confirmado incorreto para a G-Click nesta fase (ver `api-validation.md`).

## O que a documentação oficial da G-Click confirma

Um endpoint de "Gerar credenciais" que "permitirá você realizar a autenticação do seu acesso" e cujo resultado é "a geração do Token que será usado em todos os demais endpoints obrigatoriamente".

Isso é um modelo de **token de acesso obtido via um passo prévio**, não um par de chaves reenviado a cada chamada - mais parecido com um fluxo `client_credentials`/API key trocada por token do que com o modelo do Omie ERP.

## O que NÃO está confirmado nesta sessão

- O nome exato dos parâmetros de entrada do endpoint "Gerar credenciais" (`client_id`/`client_secret`? e-mail+senha da conta G-Click? uma chave única emitida por suporte?).
- O nome exato do campo de saída (`token`? `access_token`? `Token`, com T maiúsculo, como a prosa da documentação sugere?).
- Validade/expiração do token.
- Como renovar (novo request ao mesmo endpoint? refresh token separado?).
- Header exato usado nas chamadas subsequentes (`Authorization: Bearer <token>`? um header customizado tipo `X-GClick-Token`?).

## Ação tomada nesta fase

`OMIE_APP_KEY`/`OMIE_APP_SECRET` foram **removidas** do código (não há mais nenhuma leitura de `process.env` relacionada a esta integração). Nenhuma variável nova foi criada em substituição - o prompt desta fase orienta nomes como `GCLICK_CLIENT_ID`/`GCLICK_CLIENT_SECRET`/`GCLICK_API_BASE_URL` **apenas se confirmados pela documentação**, e o formato exato do fluxo de credenciais não está confirmado. Inventar nomes de variável para um modelo de autenticação não totalmente confirmado seria o mesmo erro de raiz (assumir forma sem prova), só que num nível mais abstrato.

## Nomenclatura candidata (não implementada, só registrada para quando houver confirmação)

```text
GCLICK_CLIENT_ID       (ou GCLICK_API_KEY, dependendo do que "gerar credenciais" pedir)
GCLICK_CLIENT_SECRET   (ou GCLICK_API_SECRET)
GCLICK_API_BASE_URL    (host real, hoje desconhecido)
```

Ao confirmar o formato real (via contato com a Omie ou acesso à documentação Postman), atualizar:

- `src/integrations/omie-gclick/provider.ts` (leitura das env vars corretas)
- Um novo `src/integrations/omie-gclick/gclick.adapter.ts` (implementação real, substituindo o `omie.adapter.ts` removido)
- `.env.example` (quando esse arquivo for criado - pendência herdada da Fase 0)
- `credentials-model.md` (este arquivo)

## Atualização (2026-09-21) - confirmado pelo suporte da Omie + fonte terceira

O usuário recebeu resposta do suporte da Omie confirmando o caminho de configuração (Configurações > Integrações & API > Aplicações > "Criar uma Aplicação" gera as credenciais). Uma fonte terceira independente (documentação de suporte da Jettax 360, integradora real do G-Click) confirma os nomes exatos dos 2 valores gerados: **"ID de cliente"** e **"Segredo de cliente"** - ou seja, o modelo é **Client ID / Client Secret**, não mais só uma suposição. `GCLICK_CLIENT_ID`/`GCLICK_CLIENT_SECRET` deixam de ser "nomenclatura candidata" e passam a ser os nomes corretos com alta confiança.

Ainda não confirmado: onde exatamente essas credenciais são trocadas por um token (endpoint/método/host), o nome do campo do token na resposta, o header usado nas chamadas seguintes, e o schema de cada endpoint de cliente/tarefa - a documentação Postman oficial continua inacessível a ferramentas automatizadas (SPA em JavaScript). Ver `docs/integrations/gclick/PENDING_VALIDATION.md` pra o registro vivo desta pendência.

## Regras seguidas nesta fase

- Nenhum secret real foi solicitado ao usuário nesta conversa.
- Nenhum valor de credencial (real ou de exemplo) foi commitado.
- Nenhum secret é lido fora de `server-only` (nem existia antes).
- Busca no repositório por `OMIE_`/`GCLICK_`/`client_secret`/`access_token`/`app_secret`/`Authorization`/`Bearer` não encontrou nenhum valor real - só nomes de variável e comentários (ver `audit-report.md`, Parte 12).
