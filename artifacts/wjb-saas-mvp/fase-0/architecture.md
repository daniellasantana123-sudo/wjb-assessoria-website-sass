# Arquitetura atual - fatos verificados em 2026-09-20

Todo item abaixo foi confirmado lendo o código-fonte, as migrations, o roadmap do produto ou executando um comando real - nada aqui é suposição. Onde algo não pôde ser confirmado, está marcado como tal.

## Stack

- **Framework**: Next.js 16.3.3, App Router.
- **Linguagem**: TypeScript.
- **UI**: React 19.2.8, Tailwind CSS v4.
- **Formulários**: react-hook-form + zod.
- **Banco**: PostgreSQL via Supabase.
- **ORM**: nenhum - cliente oficial `@supabase/supabase-js` (2.116.0) e `@supabase/ssr` (0.12.7) direto, sem Prisma/Drizzle.
- **Auth**: Supabase Auth (e-mail/senha, sem autocadastro público).
- **Storage**: Supabase Storage (bucket privado `documents`).
- **Hosting**: Hostinger, hospedagem com suporte a Node.js (`next start` como processo persistente), deploy automático via Git (push em `main` já dispara build + publicação, confirmado nesta mesma sessão).
- **CI/CD**: **não existe** - `.github/workflows/` não está presente no repositório atual, apesar de citado como existente em `docs/product/roadmap.md` e `docs/architecture/folder-structure.md`. Divergência entre documentação e código real.
- **Observabilidade**: nenhuma ferramenta externa (Sentry, Datadog, OpenTelemetry) instalada. Só `console.log`/`console.error` nos pontos de falha, mais a tabela `audit_log` (ver abaixo).
- **E-mail transacional**: Resend (`resend` ^6.28.1 já é dependência real do projeto).
- **WhatsApp**: Meta WhatsApp Business Platform (Cloud API), chamada direta via `fetch`, sem SDK.

## Autenticação

- Provider: Supabase Auth. Sem autocadastro - contas são criadas manualmente pelo staff via `/admin/empresas` e `/admin/usuarios` (`supabase.auth.admin.inviteUserByEmail()`/`createUser()`, client de service role em `src/lib/db/supabase/admin.ts`).
- `src/actions/auth.ts` (Server Actions): `login`, `logout`, `requestPasswordReset`, `setPassword`.
- Sessão no servidor: `src/lib/auth/dal.ts` (Data Access Layer, padrão recomendado pela documentação desta versão do Next.js). `getSession()` memoizado com `cache()` do React. Expõe `requireSession()`, `requireStaffSession()`, `getTenantRole(tenantId)`, `requireTenantAccess(tenantId)`.
- Não existe `middleware.ts` - nesta versão do Next.js o arquivo foi renomeado para `src/proxy.ts`. Faz duas coisas: renova o cookie de sessão Supabase SSR; e uma checagem otimista (só cookie, sem consultar o banco) que redireciona visitante deslogado tentando abrir `/portal*`/`/admin*` para `/login`. A checagem real e definitiva sempre acontece na DAL dentro de cada page/action.
- **Gate de publicação do SaaS**: o mesmo `proxy.ts` reescreve (404 de marca) todas as rotas `/login`, `/definir-senha`, `/recuperar-senha`, `/portal*`, `/admin*`, `/auth*` quando `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED !== "true"`. Essa env var está `false`/ausente hoje em produção - decisão registrada do usuário em 2026-09-18 de publicar só o site institucional por enquanto.

## Multi-tenant

- 1 empresa cliente = 1 linha em `tenants` (`id, name, cnpj, created_by, created_at`).
- Vínculo via `tenant_members` (`tenant_id, profile_id, role: owner|member`, unique por par).
- Isolamento 100% via Row Level Security do Postgres - nunca por filtro manual de tenant na aplicação. Funções `SECURITY DEFINER` (`is_staff()`, `my_tenant_ids()`, `is_tenant_owner()`) evitam recursão de RLS (bug real encontrado e corrigido em `0003_fix_tenant_members_rls_recursion.sql`).
- Staff da WJB (`profiles.is_wjb_staff = true`) não pertence a tenant nenhum - enxerga todas as empresas via RLS.
- Um usuário só tem uma empresa hoje - `getMyPrimaryTenant()` pega a primeira, sem seletor de contexto multi-empresa na UI.

## RBAC

Dois sistemas independentes:

- **Staff interno**: `profiles.staff_role` (`super_admin | contador | atendimento`), verificado em `src/lib/permissions/roles.ts` (`isSuperAdmin`, `canManageObligations`, `canHandleSupport`). Só `super_admin` concede/revoga acesso de outro staff (`0011_super_admin_manages_staff.sql`).
- **Papel de tenant**: `tenant_members.role` (`owner | member`). Só `owner` convida colegas pra própria empresa.

## Rotas SaaS

### `/admin` (staff) - dentro de `src/app/(site)/admin/`

`/admin`, `/admin/empresas`, `/admin/empresas/[id]`, `/admin/leads`, `/admin/logs`, `/admin/mensagens`, `/admin/mensagens/[tenantId]`, `/admin/notificacoes`, `/admin/tickets`, `/admin/tickets/[id]`, `/admin/usuarios`. Todas chamam `requireStaffSession()` e têm `robots: noindex`.

### `/portal` (cliente) - fora do grupo `(site)`, app shell próprio

`/portal`, `/portal/notificacoes`, `/portal/documentos`, `/portal/guias`, `/portal/usuarios`, `/portal/obrigacoes`, `/portal/calendario`, `/portal/mensagens`, `/portal/suporte`, `/portal/suporte/[id]`. Todas chamam `requireSession()`.

## Banco de dados

15 migrations aplicadas em ordem (`0001` a `0015`): `profiles`, `tenants`, `tenant_members`, `audit_log`, storage `documents` (bucket + tabela + categoria), `obligations`, `leads`, papel `super_admin`, `tickets` + `ticket_messages`, `messages`, `notifications`, mais 2 fixes de RLS (`0003`, `0007`, `0013`).

**Projeto Supabase real confirmado**: `wjb-website-app` (região sa-east-1/São Paulo), validado de ponta a ponta em 2026-09-16 (login real, RBAC, Storage) - conforme `docs/product/roadmap.md`. **Importante**: as credenciais desse projeto **não estão presentes nem no checkout local usado nesta auditoria (nenhum `.env.local` existe) nem no ambiente de produção da Hostinger** (`hbuilds/config/.env` só tem `NEXT_PUBLIC_SITE_URL`, confirmado via SSH nesta sessão). Ou seja: o projeto existe e já foi validado uma vez, mas hoje não há nenhuma conexão ativa configurada em nenhum ambiente acessível a esta sessão.

`src/types/database.ts` é mantido manualmente (comentário no próprio arquivo diz "provisório até existir projeto Supabase real com `gen types`"), apesar do projeto real já existir - os tipos ainda não foram gerados automaticamente a partir dele.

## Adapter Pattern (integrações externas)

Convenção já estabelecida e seguida por duas integrações reais:

```text
src/integrations/
├── email/{types,provider,resend.adapter,index}.ts
└── whatsapp-business/{types,provider,meta.adapter,index}.ts
```

`provider.ts` de cada uma é uma factory com cache em módulo que retorna o adapter real ou um adapter no-op (só loga) quando a env var de credencial está ausente - "nunca quebra o fluxo que chamou". Hoje, sem `RESEND_API_KEY`/`EMAIL_FROM` nem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_LEAD_TEMPLATE_NAME` configuradas em nenhum ambiente, ambos os adapters rodam em modo no-op.

Pontos de disparo reais: `src/lib/notifications.ts::notifyTicketOrMessageEvent` (e-mail em eventos de Tickets/Mensagens) e `src/app/api/leads/route.ts` (e-mail + WhatsApp a cada lead novo).

**Nenhum adapter de ERP/fiscal existe** (Omie.G-Click ou qualquer outro) - decisão de produto de 2026-09-16, reconfirmada em 2026-09-20: o fluxo de tarefas/documentos/obrigações é nativo dentro do próprio Portal.

## Feature flags

- `src/config/features.ts` - objeto estático (`clientPortal`, `openingTracker`, `plansPricing`, `invoiceModule`, `payrollModule`, `financialDashboard`, `integrationsHub`, `calculators`, `blog`, `armelxPartnership`).
- `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` - env var que liga/desliga o SaaS inteiro (ver seção Autenticação acima).

## Testes

- **Unit/integração**: Vitest, 7 arquivos, 42 testes, todos passando (`npm run test`).
- **E2E**: Playwright, projetos `chromium` + `mobile-chrome`. Specs relevantes ao SaaS: `portal-auth.spec.ts` (login cliente/staff, redirect por papel, logout), `tickets.spec.ts` (fluxo completo de chamado, inclui regressão do IDOR corrigido - ver `decisions.md`). Dependem de `E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_PASSWORD` em `.env.local` - ausentes nesta auditoria, então esses specs são pulados automaticamente (comportamento deliberado, não falha).
- `.env.example` **não existe** no repositório atual, apesar de citado como existente em `playwright.config.ts`, nos specs e em `docs/architecture/folder-structure.md`.

## Segurança e auditoria

- Rate limiting: `src/lib/security/rate-limit.ts`, em memória (best-effort, não durável em serverless).
- Auditoria estruturada: tabela `audit_log` (`actor_id, tenant_id, action, entity, entity_id, metadata jsonb`), única fonte de log persistente do sistema. RLS: staff lê tudo, insert só da própria ação.
- Pentest interno já rodado em 2026-09-17 (`docs/product/roadmap.md`): encontrou e corrigiu um IDOR real em `replyTicket` (um membro comum conseguia injetar mensagem em ticket de outra empresa manipulando o `tenantId` da Server Action). Mesmo padrão de correção replicado em `updateTicketStatus`, `toggleObligationStatus`, `deleteObligation`, `deleteDocument`.

## Secrets

- Nenhum secret hardcoded encontrado no código-fonte (`grep` por padrões comuns de chave/token não encontrou nada além de um comentário de aviso).
- `.gitignore` cobre `.env*.local` corretamente.
- Nenhum arquivo `.env*` existe no checkout local usado nesta auditoria.
- Produção (Hostinger, `hbuilds/config/.env`) só tem `NEXT_PUBLIC_SITE_URL` configurada.

## Achados de limpeza (não bloqueantes, corrigidos nesta auditoria)

- Uma pasta `LOG_imapsync/` (logs de uma migração de e-mail feita nesta mesma sessão, sem relação com o código do site) estava solta na raiz do repositório, sem estar no `.gitignore` - movida pra fora do repositório e adicionada ao `.gitignore`.
- `.claude/` (config local de skills do Claude Code, específica desta máquina) também não estava no `.gitignore` - adicionada.
