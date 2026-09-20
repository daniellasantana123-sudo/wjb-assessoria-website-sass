# Cenários do MockGClickProvider

`createMockGClickProvider()` (`src/integrations/omie-gclick/mock.provider.ts`) parte sempre com o cenário `SUCCESS` e 1 cliente fixture já cadastrado (`MOCK_CLIENT_EXISTING`, `src/integrations/omie-gclick/fixtures.ts`). Determinístico - nenhum `Math.random()`, nenhuma dependência de tempo real.

## Trocar de cenário

```ts
const provider = createMockGClickProvider();
provider.setScenario("RATE_LIMIT");
// toda chamada seguinte a clients.*/tasks.* falha com RATE_LIMITED, até trocar de novo
provider.reset(); // volta a SUCCESS + só o fixture inicial
```

## Cenários disponíveis

| Cenário | `ProviderErrorCode` resultante | Observação |
|---|---|---|
| `SUCCESS` (padrão) | - | Comportamento normal, todas as operações funcionam |
| `AUTH_ERROR` | `AUTHENTICATION_ERROR` | Simula credencial inválida |
| `RATE_LIMIT` | `RATE_LIMITED` | Inclui `retryAfterMs: 1000` |
| `TIMEOUT` | `TIMEOUT` | Simula tempo limite excedido |
| `UNAVAILABLE` | `UNAVAILABLE` | Simula provider fora do ar |
| `VALIDATION_ERROR` | `VALIDATION_ERROR` | Simula dados inválidos |

## Cenários que independem do `scenario` ativo

- **Duplicidade**: `clients.create()` com uma `externalReference` já cadastrada sempre devolve `DUPLICATE`, mesmo em `SUCCESS`.
- **Cliente inexistente**: `clients.update()` com um `externalId` que não existe sempre devolve `NOT_FOUND`, mesmo em `SUCCESS`.

## Fixtures disponíveis (`fixtures.ts`)

- `MOCK_CLIENT_DEFAULT` - modelo de input pra criar um cliente novo (sem `externalId` ainda).
- `MOCK_CLIENT_EXISTING` - cliente já "sincronizado" (`externalId: "9001"`), pré-cadastrado em toda instância nova do mock.
- `MOCK_TASK_OPEN`/`MOCK_TASK_COMPLETED` - devolvidos por `tasks.list()`.

Todos os dados são fictícios (CNPJ/nome/e-mail de exemplo, nunca de cliente real da WJB).
