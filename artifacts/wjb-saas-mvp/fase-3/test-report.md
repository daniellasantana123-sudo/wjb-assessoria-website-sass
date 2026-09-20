# Relatório de testes e build - Fase 3

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
 Test Files  16 passed (16)
      Tests  99 passed (99)
```

99 testes = 80 já existentes (Fases 0-2) + 19 novos desta fase:

- `src/tests/unit/documents.test.ts` - 8 testes (`isAllowedMimeType` aceita/rejeita; `sanitizeFileName` cobre nome seguro, path traversal, caracteres especiais, pontos no início, string vazia, limite de tamanho).
- `src/tests/integration/documents-download-api.test.ts` - 4 testes (401 sem sessão, 404 quando RLS não retorna o documento, sucesso com auditoria e redirect, staff não precisa de `getTenantRole`).
- `src/tests/integration/documents-upload-action.test.ts` - 7 testes (sem permissão, tamanho, MIME, antimalware reprovando, sanitização aplicada na storage key, sucesso com auditoria, rollback do Storage quando o insert falha).

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages
```

Rota nova confirmada na saída: `ƒ /api/documents/[id]/download`.
