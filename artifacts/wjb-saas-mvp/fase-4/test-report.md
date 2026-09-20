# Relatório de testes e build - Fase 4

Executado em 2026-09-20, branch `main`.

## Lint

```text
$ npm run lint
> eslint
(sem saída - sem erros nem avisos)
```

## Typecheck

```text
$ npm run typecheck
> next typegen && tsc --noEmit
✓ Types generated successfully
(sem erros)
```

## Testes (Vitest)

```text
$ npm run test
 Test Files  18 passed (18)
      Tests  116 passed (116)
```

116 testes = 99 já existentes (Fases 0-3) + 17 novos desta fase:

- `src/tests/unit/omie-gclick-adapter.test.ts` - 5 testes (`IncluirCliente` vs. `AlterarCliente`, `faultstring` no corpo tratado como erro sem lançar, falha de rede nunca lança, fallback no-op nunca chama a rede).
- `src/tests/integration/omie-gclick-actions.test.ts` - 11 testes (`saveOmieMapping`: sem permissão, URL não-https rejeitada, status `connected`/`pending` corretos, auditoria; `syncOmieClient`: sem permissão, empresa inexistente, sucesso com transição `syncing`→`synced`, falha do adapter marca `error`; `setOmieMappingDisabled`: sem permissão, desativa, reativa como `connected` quando já há `external_client_id`).
- `src/tests/unit/permissions.test.ts` - 1 teste novo (`integrations.read` no cliente, `integrations.manage` nunca).

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages using 3 workers (81/81)
```

Nenhuma rota nova na saída do build - a integração inteira roda via Server Actions (`/admin/empresas/[id]` e `/portal` já existiam, sem rota adicional).
