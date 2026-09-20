# Relatório de testes e build - Fase 2

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
 Test Files  13 passed (13)
      Tests  80 passed (80)
```

80 testes = 56 já existentes (Fases 0/1) + 24 novos desta fase:

- `src/tests/integration/mfa-actions.test.ts` - 11 testes (enroll, verify, unenroll, listFactors, challenge de login).
- `src/tests/integration/tenant-context.test.ts` - 7 testes (getMyOrganizations, getActiveTenant com/sem cookie válido, switchActiveTenant com validação server-side).
- `src/tests/integration/account-status-actions.test.ts` - 6 testes (suspendAccount, reactivateAccount, suspendMember, reactivateMember, incluindo guarda de auto-suspensão e de permissão).
- `src/tests/integration/me-api.test.ts` e `me-organizations-api.test.ts` - contagem de testes inalterada, mocks atualizados pra `getActiveTenant`/`getMyOrganizations`.

Ver `decisions.md` D6 pra uma limitação de teste conhecida (checagem de `status` suspenso dentro de `getSession()`/`getTenantRole()`, não coberta por teste automatizado por causa de como `cache()` do React memoiza nos testes).

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages
```

Rotas novas confirmadas na saída: `ƒ /verificar-mfa`, `ƒ /portal/seguranca`, `ƒ /admin/seguranca` (todas dinâmicas, como esperado pra rotas que leem sessão).
