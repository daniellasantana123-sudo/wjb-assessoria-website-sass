# Relatório de testes e build - Fase 0

Executado em 2026-09-20, checkout local em `/Users/armelsantana/wjb-assessoria-website-sass`, branch `main` (commit `0c6ebf0b`).

## Lint

```text
$ npm run lint
> eslint
(sem saída - sem erros nem avisos)
```

**Resultado: limpo.**

## Typecheck

```text
$ npm run typecheck
> next typegen && tsc --noEmit

Generating route types...
✓ Types generated successfully
```

**Resultado: limpo.**

## Testes unitários e de integração (Vitest)

```text
$ npm run test
> vitest run

 Test Files  7 passed (7)
      Tests  42 passed (42)
```

**Resultado: 42/42 passando.**

Nota: os testes E2E (Playwright) de `/portal` e `/admin` (`portal-auth.spec.ts`, `tickets.spec.ts`) não foram executados nesta auditoria - dependem de `E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_PASSWORD` e `NEXT_PUBLIC_SUPABASE_URL` em `.env.local`, ausentes neste checkout (ver `decisions.md` D2). Os specs pulam automaticamente sem essas variáveis (`test.skip`), então isso não é uma falha - é uma limitação de ambiente já prevista no próprio código do teste.

## Build de produção

```text
$ npm run build
> next build --webpack

✓ Compiled successfully in 15.4s
✓ Running TypeScript ... Finished
✓ Generating static pages (76/76)
```

**Resultado: sucesso.** 76 rotas geradas, incluindo todas as rotas de `/admin` e `/portal` (marcadas `ƒ` - dinâmicas, renderizadas sob demanda, como esperado para rotas autenticadas).

Aviso não bloqueante do Next.js: `package-lock.json` fora do repositório Git raiz (`/Users/armelsantana` vs. `/Users/armelsantana/wjb-assessoria-website-sass`) - específico deste ambiente local, não afeta o build de produção na Hostinger.
