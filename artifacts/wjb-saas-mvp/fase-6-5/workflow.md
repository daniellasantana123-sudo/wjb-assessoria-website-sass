# Workflow da Fase 6.5

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: FASE_6_5_VALIDACAO_TECNICA_OMIE_GCLICK.md] --> B[Ler Claude.md, artifacts das Fases 0-6, STATUS.md]
    B --> C[Inventariar implementacao Omie.G-Click existente]
    C --> D[Buscar documentacao oficial ajuda.omie.com.br via WebFetch]
    D --> E{Postman tecnico acessivel?}
    E -->|Nao - SPA em JS| F[Registrar limitacao, nao inventar conteudo]
    E -->|Paginas de ajuda acessiveis| G[Extrair fatos confirmados]
    G --> H{Adapter da Fase 4 bate com a doc oficial?}
    H -->|Nao| I[Gap G1 critical: API errada - Omie ERP, nao G-Click]
    I --> J[Gap G2 high: env vars do modelo errado]
    J --> K[Gap G4 medium: CTA com premissa de URL por tenant, errada]
    K --> L[Escrever audit-report.md com gaps e decisao]
    L --> M[Corrigir G1/G2/G4 - incremental, sem reescrever o modulo]
    M --> N[Atualizar testes]
    N --> O[Rodar lint, typecheck, test, build]
    O --> P{Tudo limpo?}
    P -->|Nao| N
    P -->|Sim| Q[Escrever demais artifacts: api-validation, credentials-model, omie-contact-checklist]
    Q --> R[Escrever phase-handoff.md e atualizar STATUS.md]
    F --> L
```

## Fluxo de dados - Antes x depois da correção

```mermaid
sequenceDiagram
    participant Staff
    participant Action as syncOmieClient
    participant Adapter as getOmieGClickAdapter()
    participant Wrong as omie.adapter.ts (removido)
    participant Real as API real da G-Click

    Note over Staff,Real: ANTES (Fase 4) - se OMIE_APP_KEY/SECRET estivessem configuradas
    Staff->>Action: clica "Sincronizar"
    Action->>Adapter: upsertClient(...)
    Adapter->>Wrong: createOmieAdapter(appKey, appSecret)
    Wrong->>Real: POST app.omie.com.br (API ERRADA - Omie ERP)
    Note over Wrong,Real: risco real: se as chaves fossem validas<br/>pro Omie ERP da propria WJB, isso criaria/<br/>alteraria um cliente no sistema ERRADO

    Note over Staff,Real: DEPOIS (Fase 6.5)
    Staff->>Action: clica "Sincronizar"
    Action->>Adapter: upsertClient(...)
    Adapter-->>Action: sempre { ok: false, error: "blocked-by-provider" }
    Note over Adapter: nunca chama rede - seguro por padrao ate a<br/>especificacao tecnica real ser confirmada
```

## Dependências

- `src/lib/permissions/permissions.ts` (Fase 1), `src/lib/feature-flags.ts` (Fase 5) - reaproveitados sem alteração.
- `my_tenant_ids()` (corrigida na Fase 5) - base da validação de isolamento nesta auditoria.
- Nenhuma dependência npm nova. `WebFetch`/`WebSearch` usados só para pesquisa (não fazem parte do código do produto).

## Testes

- `src/tests/unit/omie-gclick-provider.test.ts` (novo) - 3 testes: `isOmieConfigured()` sempre falso, `upsertClient`/`testConnection` nunca chamam `fetch`, sempre resolvem com `blocked-by-provider`.
- `src/tests/unit/omie-gclick-adapter.test.ts` (removido) - testava a implementação incorreta, não fazia mais sentido manter.
- `src/tests/integration/omie-gclick-actions.test.ts` - sem alteração necessária (mocka `@/integrations/omie-gclick` no nível de interface, não conhece a implementação interna).

## Saídas

- 1 arquivo removido (`omie.adapter.ts`), 1 arquivo novo (`constants.ts`).
- `provider.ts`/`types.ts` reescritos para refletir o estado `BLOCKED_BY_PROVIDER` honestamente.
- `OmiePortalCta` corrigido (URL real como fallback).
- Copy de 2 componentes + 1 página corrigida.
- `docs/api/integrations.md` e artifacts das Fases 4/5 atualizados com adendos (sem reescrever histórico).
- 8 artifacts novos desta fase + `STATUS.md` atualizado.
- 3 testes novos, 5 removidos (líquido: -2, pela remoção do arquivo que testava a implementação errada).

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo, decisão documentada (`BLOCKED_BY_PROVIDER`) - fase concluída. Fase 7 (gate explícito do prompt) só deveria iniciar com `VALIDATED` ou `BLOCKED_BY_CREDENTIALS` - ver `phase-handoff.md` para a leitura literal desse critério aplicada ao resultado desta fase.
