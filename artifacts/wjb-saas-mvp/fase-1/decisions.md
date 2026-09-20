# Decisões - Fase 1

## D1 - Não renomear/duplicar o backend já validado

**Contexto**: o prompt pede tabelas `users`, `organizations`, `memberships`, `invitations`, `sessions` - nomes diferentes do que já existe e está validado em produção desde 2026-09-16 (`profiles`, `tenants`, `tenant_members`, fluxo nativo de convite do Supabase Auth, sessão JWT nativa).

**Decisão do usuário (2026-09-20)**: "Só fechar os gaps reais" - não renomear `tenants`/`tenant_members`, não criar uma tabela `invitations` nem `sessions` próprias, não migrar o fluxo de convite. Ver `architecture.md` para o mapeamento completo domínio-a-domínio.

## D2 - Permissões finas como camada aditiva, não substituição

**Decisão**: `src/lib/permissions/permissions.ts` foi criado ao lado de `src/lib/permissions/roles.ts`, sem alterar nenhuma Server Action existente para usar a nova camada. Reescrever `src/actions/*.ts` para checar `hasPermission()` em vez das funções nomeadas atuais seria uma mudança de comportamento potencial em código já testado em produção, sem necessidade real - a autorização de fato continua sendo `roles.ts` + RLS. A nova camada existe para código futuro.

**Achado registrado durante a implementação**: `canManageObligations()` (em `roles.ts`) existe mas não é usada em nenhuma Server Action hoje - confirmado via busca no código. Os mapas de permissão desta fase refletem esse comportamento real (contador e atendimento com as mesmas permissões), não uma distinção aspiracional. Não removi `canManageObligations()` - fora do escopo desta fase, e removê-la sem necessidade contraria a regra de preservar o que já existe.

## D3 - Só 2 dos 6 endpoints REST pedidos foram criados

**Decisão**: `GET /api/me` e `GET /api/me/organizations` foram criados (não existiam, não duplicam nada). Os outros 4 (`GET /api/organizations/:id`, `GET /api/organizations/:id/members`, `POST /api/organizations/:id/invitations`, `PATCH /api/memberships/:id`, `DELETE /api/memberships/:id` - na verdade 5, a lista do prompt tem 5 além do `/api/me`) não foram criados porque duplicariam funcionalidade que já existe e funciona via Server Actions (`src/actions/tenants.ts::inviteMember`, páginas de `/admin/empresas/[id]` e `/portal/usuarios`). Criar uma camada REST paralela para algo que já tem UI funcionando seria "duplicar arquitetura já existente", indo contra as regras do próprio prompt.

**Quando reconsiderar**: se um consumidor externo real precisar desses endpoints (um app mobile, uma integração de terceiros) que não possa usar Server Actions do Next.js, voltar a este item.

## D4 - `/api/me` entra no gate do SaaS

**Decisão**: adicionada à lista `GATED_PREFIXES` de `src/proxy.ts`, mesmo padrão de `/login`/`/portal`/`/admin`. Sem isso, uma sessão pré-existente (cookie antigo) poderia consultar `/api/me` mesmo com o SaaS "desligado" ao público - inconsistente com a decisão de 2026-09-18 de manter o SaaS inteiro invisível até estar pronto.

## D5 - Nenhuma dependência nova instalada

Toda a implementação usa só o que já estava no `package.json` (Next.js, Supabase client, Vitest). Nenhum pacote novo foi adicionado.
