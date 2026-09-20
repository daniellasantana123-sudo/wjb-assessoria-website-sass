# Handoff - Fase 1 para a próxima fase

## O que está pronto

- Mapeamento completo entre o modelo de domínio pedido e o backend real já existente - ver `architecture.md`.
- Sistema de permissões finas (`src/lib/permissions/permissions.ts`), testado (7 testes unitários).
- `GET /api/me` e `GET /api/me/organizations`, testados (7 testes de integração), protegidos pelo mesmo gate do resto do SaaS.
- Lint, typecheck, 56 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- Endpoints REST de organizações/membros/convites (`/api/organizations/:id`, etc.) - duplicariam Server Actions já existentes. Ver `decisions.md` D3.
- Qualquer renomeação de `tenants`/`tenant_members` ou criação de tabelas `invitations`/`sessions` próprias - decisão do usuário de preservar o que já funciona. Ver `decisions.md` D1.

## Pendências herdadas da Fase 0 (ainda não resolvidas)

- Credenciais do projeto Supabase real (`wjb-website-app`) continuam ausentes em todos os ambientes acessíveis - `/api/me`/`/api/me/organizations` não puderam ser testados contra um banco real nesta sessão (só via mocks). Recomenda-se um teste manual de ponta a ponta assim que as credenciais forem reconectadas.
- `.env.example` e `.github/workflows/` continuam ausentes.

## Riscos

- `getPermissions`/`hasPermission` não são chamados por nenhuma Server Action existente ainda - são scaffolding para código futuro. Se uma fase futura decidir migrar a autorização de `roles.ts` para `permissions.ts` de fato, isso precisa ser feito com cuidado, arquivo por arquivo, com teste antes/depois (não é o escopo desta fase).

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário.
