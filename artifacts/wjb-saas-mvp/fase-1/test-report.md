# Relatório de testes e build - Fase 1

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
✓ Types generated successfully
(sem erros)
```

## Testes (Vitest)

```text
$ npm run test
 Test Files  10 passed (10)
      Tests  56 passed (56)
```

56 testes = 42 já existentes (Fase 0) + 14 novos desta fase:

- `src/tests/unit/permissions.test.ts` - 7 testes.
- `src/tests/integration/me-api.test.ts` - 4 testes (`GET /api/me`).
- `src/tests/integration/me-organizations-api.test.ts` - 3 testes (`GET /api/me/organizations`).

7 + 4 + 3 = 14, batendo exatamente com a diferença 56-42 confirmada na saída do Vitest.

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages (78/78)
```

Novas rotas confirmadas na saída: `ƒ /api/me`, `ƒ /api/me/organizations` (dinâmicas, como esperado para rotas que leem sessão).
