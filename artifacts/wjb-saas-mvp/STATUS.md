# Status - wjb-saas-mvp

## Fase atual

**Fase 1 - Fundação Backend SaaS**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `src/lib/permissions/permissions.ts` - novo (permissões finas, aditivo a `roles.ts`).
- `src/app/api/me/route.ts` - novo (`GET /api/me`).
- `src/app/api/me/organizations/route.ts` - novo (`GET /api/me/organizations`).
- `src/proxy.ts` - `/api/me` adicionado ao gate do SaaS.
- `src/tests/unit/permissions.test.ts` - novo, 7 testes.
- `src/tests/integration/me-api.test.ts` - novo, 4 testes.
- `src/tests/integration/me-organizations-api.test.ts` - novo, 3 testes.
- `artifacts/wjb-saas-mvp/fase-1/*` - criado.
- `artifacts/wjb-saas-mvp/STATUS.md` - atualizado (este arquivo).

Nenhuma tabela, migration, dependência nova ou renomeação de código existente.

## Testes

Lint, typecheck, 56 testes (42 anteriores + 14 novos) e build de produção (78 rotas) - todos passando. Detalhe completo em `fase-1/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real (`wjb-website-app`) ausentes em todos os ambientes acessíveis - `/api/me`/`/api/me/organizations` só foram testados via mock, não contra banco real.
- `getPermissions`/`hasPermission` ainda não são usados por nenhuma Server Action existente - scaffolding pronto pra uso futuro, não enforcement real ainda.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 1. Endpoints REST adicionais (organizações/membros/convites) ficaram fora de escopo por decisão do usuário - não são um bloqueio, são um "não fazer" deliberado (ver `fase-1/decisions.md` D3).

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (mantida desde a Fase 0)

A integração Omie.G-Click **não faz parte** deste projeto - decisão de produto de 2026-09-16, reconfirmada em 2026-09-20.
