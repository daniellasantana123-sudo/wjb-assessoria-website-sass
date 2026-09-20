# Matriz de mapeamento - modelo interno WJB x G-Click

Nenhuma coluna "Campo G-Click" foi preenchida por suposição - todas aguardam a documentação técnica oficial (Postman) ou contato direto com a Omie. Ver `PENDING_VALIDATION.md`.

## Cliente

| Modelo interno WJB (`ExternalClient`) | Campo G-Click | Status |
|---|---|---|
| `internalId` (tenant.id da WJB) | ? | aguardando |
| `externalId` | ? | aguardando |
| `externalReference` | ? | aguardando |
| `name` | ? | aguardando |
| `document` | ? | aguardando |
| `status` | ? | aguardando |
| `metadata` | ? | aguardando |
| `createdAt` | ? | aguardando |
| `updatedAt` | ? | aguardando |

## Tarefa / pré-tarefa

| Modelo interno WJB (`ExternalTask`) | Campo G-Click | Status |
|---|---|---|
| `externalId` | ? | aguardando |
| `clientExternalId` | ? | aguardando |
| `title` | ? | aguardando |
| `status` | ? | aguardando |
| `dueDate` | ? | aguardando |

## Autenticação

| Conceito interno | Campo G-Click | Status |
|---|---|---|
| Client ID / chave de app | ? (nome do parâmetro do endpoint "Gerar credenciais") | aguardando |
| Client Secret | ? | aguardando |
| Token de acesso | ? (nome do campo de resposta - `token`? `access_token`? `Token`?) | aguardando |
| Header de autenticação | ? (`Authorization: Bearer`? header customizado?) | aguardando |

Atualizar esta matriz é o primeiro passo ao receber a documentação técnica oficial - os `mappers/` (`src/integrations/omie-gclick/mappers/`) são implementados diretamente a partir dela.
