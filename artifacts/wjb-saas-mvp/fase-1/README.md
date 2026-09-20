# Fase 1 - Fundação Backend SaaS

## Objetivo original do prompt

Criar a base segura de usuários, empresas, papéis, permissões, convites, sessões, auditoria e feature flags.

## O que mudou antes de implementar

A Fase 0 (auditoria) já tinha mostrado que praticamente todos esses domínios já existem e estão validados em produção desde 2026-09-16, só com nomes/mecanismos diferentes dos que este prompt sugere (`organizations` em vez de `tenants`, `memberships` em vez de `tenant_members`, convite via tabela própria em vez do fluxo nativo do Supabase Auth). Apresentei essa sobreposição ao usuário antes de escrever qualquer código - ver `decisions.md` D1.

**Decisão do usuário**: não renomear nem duplicar o que já funciona. Fechar só os gaps reais:

1. Sistema de permissões finas (o prompt pede `organizations.read`, `documents.upload` etc. - hoje só existem funções de papel nomeadas).
2. Endpoints `GET /api/me` e `GET /api/me/organizations` (não existiam - o resto da lista de endpoints do prompt duplicaria Server Actions já existentes e testadas, por isso não foi criado, ver `decisions.md` D3).

Todo o resto do domínio (users/organizations/memberships/roles/invitations/sessions/audit/feature-flags) está documentado em `architecture.md` como "já satisfeito", com o mapeamento explícito pro que já existe.

## Arquivos criados/alterados nesta fase

- `src/lib/permissions/permissions.ts` - novo. Camada de permissões finas (`Permission`, `hasPermission`, `getPermissions`), ao lado de `src/lib/permissions/roles.ts` (não o substitui).
- `src/app/api/me/route.ts` - novo. `GET /api/me`, retorna o `AuthContext` da sessão atual.
- `src/app/api/me/organizations/route.ts` - novo. `GET /api/me/organizations`, lista as empresas vinculadas ao usuário (staff recebe lista vazia, por não ser `tenant_member`).
- `src/proxy.ts` - `/api/me` adicionado à lista de rotas bloqueadas quando `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` não está `true` (consistência com o resto do SaaS, que já fica invisível ao público).
- `src/tests/unit/permissions.test.ts` - novo, 7 testes.
- `src/tests/integration/me-api.test.ts` - novo, 4 testes.
- `src/tests/integration/me-organizations-api.test.ts` - novo, 3 testes.

Ver `architecture.md`, `decisions.md`, `checklist.md`, `test-report.md`, `phase-handoff.md` e `workflow.md` para o detalhe completo.
