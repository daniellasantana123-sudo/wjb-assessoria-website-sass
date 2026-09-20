# Arquitetura - Integração Omie.G-Click

## Camadas

```text
Portal/Admin (UI)
      │
      ▼
Server Action (src/actions/omie-gclick.ts) - Authorization + Application Service
      │
      ▼
OmieGClickAdapter (contrato, src/integrations/omie-gclick/types.ts)
      │
      ├──────────────► MockGClickProvider (mock.provider.ts)
      │                    └── modo "mock" - funcional, em memória, determinístico
      │
      └──────────────► GClickHttpProvider (http.provider.ts)
                           └── modo "sandbox"/"production" - SEMPRE bloqueado
                               (PROVIDER_NOT_CONFIGURED), nenhuma chamada de rede
```

A UI (React Server/Client Components) nunca importa `src/integrations/omie-gclick` diretamente - só as Server Actions. As Server Actions nunca chamam `fetch` contra a G-Click diretamente - só o adapter, resolvido via `getOmieGClickAdapter()`.

## Arquivos

```text
src/integrations/omie-gclick/
├── types.ts        - DTOs (ExternalClient, ExternalTask, ...), ProviderError/Result,
│                      ProviderCapabilities, contrato OmieGClickAdapter
├── config.ts        - GCLICK_MODE, GCLICK_REAL_INTEGRATION_ENABLED e demais env vars
├── fixtures.ts       - dados fictícios (MOCK_CLIENT_DEFAULT, MOCK_CLIENT_EXISTING, tarefas)
├── mock.provider.ts   - MockGClickProvider (funcional, em memória, com setScenario/reset)
├── http.provider.ts   - GClickHttpProvider (esqueleto - todo método bloqueia)
├── mappers/
│   ├── client.mapper.ts - GClickClientMapper (esqueleto, TODO_GCLICK_VALIDATION)
│   ├── task.mapper.ts   - GClickTaskMapper (esqueleto, TODO_GCLICK_VALIDATION)
│   └── error.mapper.ts  - GClickErrorMapper (esqueleto, TODO_GCLICK_VALIDATION)
├── constants.ts      - GCLICK_CLIENT_PORTAL_URL (confirmado via doc oficial, Fase 6.5 anterior)
├── provider.ts       - factory: getOmieGClickAdapter() escolhe mock/http conforme GCLICK_MODE
└── index.ts          - barrel export
```

## Contrato (`OmieGClickAdapter`)

```ts
interface OmieGClickAdapter {
  healthCheck(): Promise<ProviderHealth>;
  getCapabilities(): ProviderCapabilities;
  clients: {
    create(input): Promise<ProviderResult<ExternalClient>>;
    update(input): Promise<ProviderResult<ExternalClient>>;
    findById(externalId): Promise<ProviderResult<ExternalClient | null>>;
    findByExternalReference(reference): Promise<ProviderResult<ExternalClient | null>>;
    list(input?): Promise<ProviderResult<PaginatedResult<ExternalClient>>>;
  };
  tasks: {
    list(input?): Promise<ProviderResult<PaginatedResult<ExternalTask>>>;
    createPreTask(input): Promise<ProviderResult<ExternalTask>>;
  };
}
```

**Nenhum método lança exceção** - todos resolvem `ProviderResult<T>` (`{ok:true,data}` ou `{ok:false,error}`). Essa é uma adaptação deliberada do exemplo conceitual do prompt (que usa `throw`) para o padrão já consolidado neste projeto (`email`, `whatsapp-business`, `antivirus`: adapter nunca lança) - ver "Decisões" no fim deste arquivo.

## Idempotência

`syncOmieClient` (`src/actions/omie-gclick.ts`) sempre checa `omie_client_mappings.external_client_id` antes de decidir entre `clients.create()` e `clients.update()` - nunca cria duas vezes o mesmo tenant.

## Erros padronizados

```ts
type ProviderErrorCode =
  | "PROVIDER_NOT_CONFIGURED" | "AUTHENTICATION_ERROR" | "AUTHORIZATION_ERROR"
  | "VALIDATION_ERROR" | "NOT_FOUND" | "DUPLICATE" | "RATE_LIMITED"
  | "TIMEOUT" | "UNAVAILABLE" | "UNKNOWN_PROVIDER_ERROR";
```

Independentes de HTTP externo - o `error.mapper.ts` (esqueleto) é o único lugar que traduziria um código HTTP/corpo de erro real da G-Click pra um desses.

## Capabilities

`getCapabilities()` nunca libera `canReplyActivity`/`canCreatePreTaskWithTag` (recursos `partner_only`, confirmados na auditoria da Fase 6.5 anterior) - nem no mock, nem no provider real. O provider real começa com TODAS as capacidades `false` (unknown, não confirmado) até uma implementação real existir.

## Segurança

- Nenhum segredo é lido fora de `server-only`.
- `GClickHttpProvider` nunca chama `fetch` - impossível vazar header/token que nem existe ainda.
- `GCLICK_REAL_INTEGRATION_ENABLED` é uma trava adicional, redundante por design: mesmo `true`, sem uma implementação real em `http.provider.ts`, nada muda.

## Decisões

- **Adapter nunca lança exceção** - resolve `ProviderResult<T>` sempre, mesmo padrão já usado em toda outra integração do projeto (`email`, `whatsapp-business`, `antivirus`, e o próprio `OmieGClickAdapter` desde a Fase 4). Preferido em vez do estilo de exceções do exemplo conceitual do prompt-fonte, por consistência ("reaproveitar padrões já existentes", regra da própria Fase 6.5).
- **Nome do contrato mantido `OmieGClickAdapter`** (não renomeado pra `AccountingWorkflowProvider`/`GClickProvider`) - já é usado em toda a documentação histórica das Fases 4-6.5 anteriores; mudar o nome sem necessidade fragmentaria essas referências sem ganho real.
- **`GCLICK_MODE`, não `ACCOUNTING_PROVIDER_MODE`** - o projeto nomeia variáveis de integração pelo nome específico do provider (`WHATSAPP_*`, `RESEND_*`), não por um conceito de domínio genérico; esta é a única integração de "workflow contábil" hoje, então um nome genérico não traria benefício real.
- **Nenhuma migration nova** - `omie_client_mappings` (Fase 4) e `omie_integration_status` (mesma fase) já cobrem o que o prompt pede como `integration_mappings`/status genérico. Criar uma tabela paralela violaria a própria regra do prompt ("se já existir tabela equivalente, reutilize").
- **Mappers (`mappers/`) existem como esqueleto isolado, nunca importados por `http.provider.ts`** - referenciá-los em código morto (chamado só depois de um `return` bloqueado) seria pior que documentá-los em comentário: o objetivo é sinalizar onde a tradução entra, não fingir que já está conectada.

