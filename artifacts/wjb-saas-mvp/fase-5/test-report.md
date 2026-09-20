# Relatório de testes e build - Fase 5

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
 Test Files  21 passed (21)
      Tests  147 passed (147)
```

147 testes = 116 já existentes (Fases 0-4) + 31 novos desta fase:

- `src/tests/integration/admin-console-actions.test.ts` (novo) - 14 testes: `updateTenant` (qualquer staff edita, rejeita nome vazio), `suspendTenant`/`reactivateTenant` (privilege escalation: contador/atendimento bloqueados; super_admin suspende/reativa com auditoria), `updateMemberRole`/`revokeMemberAccess` (staff troca papel e revoga com auditoria), `resendMemberInvite` (rejeita não-owner/não-staff, reenvia, erro do Supabase vira mensagem genérica), `resendStaffInvite` (privilege escalation), `setFeatureFlag` (privilege escalation).
- `src/tests/unit/feature-flags.test.ts` (novo) - 3 testes: `isFeatureEnabled` (valor salvo e fallback seguro), `listFeatureFlags` (sempre as 3 keys conhecidas, mesmo com banco incompleto).
- `src/tests/unit/audit-log.test.ts` (novo) - 8 testes: cada filtro isoladamente (tenant/ação/período/usuário), busca por usuário sem resultado, mapeamento de linha, `listTenantOptions`.
- `src/tests/integration/omie-gclick-actions.test.ts` - 4 novos: `testOmieConnection` (sem permissão, sucesso com auditoria, falha sanitizada) e gate de feature flag em `syncOmieClient`.
- `src/tests/integration/documents-upload-action.test.ts` - 1 novo: gate de feature flag em `uploadDocument`.
- `src/tests/unit/permissions.test.ts` - 1 novo: `feature_flags.manage`/`tenants.suspend` só super_admin.

## Build

```text
$ npm run build
✓ Compiled successfully
✓ Generating static pages using 3 workers (82/82)
```

Rota nova confirmada na saída: `ƒ /admin/integracoes`.
