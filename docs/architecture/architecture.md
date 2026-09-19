# Arquitetura

> Status: **FASE 1 — Fundação Técnica e Design System** (em andamento).

Projeto inicializado com `create-next-app` (Next.js 16, App Router, Turbopack por padrão, React 19, TypeScript, Tailwind CSS v4). Ver [`folder-structure.md`](./folder-structure.md) para o estado atual das pastas.

Referência de produto e regras gerais: [`../../Wjb-Website.md`](../../Wjb-Website.md).

## Stack — Versão 1 (seção 21 do documento mestre)

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui (ou componentes acessíveis equivalentes)
- Lucide Icons
- React Hook Form
- Zod
- ~~Vercel~~ **Hostinger** (2026-08-31, decisão do usuário — o documento mestre recomendava Vercel na seção 21, mas o site será hospedado na Hostinger). Como o projeto tem rotas dinâmicas reais (`/api/leads`, `/planos/simulador`), precisa de um plano com suporte a Node.js (VPS ou hospedagem com Node.js app, não hospedagem compartilhada só estática) — confirmar qual plano da Hostinger antes de preparar o deploy.

## Stack — Versão 2 (seção 22 do documento mestre)

**Iniciada em 2026-09-16** por decisão explícita do cliente, antes da aprovação formal da V1
prevista pelo gate da seção 33 (ver `docs/product/roadmap.md`, "Gate V1 → V2").

- Next.js / React / TypeScript
- PostgreSQL / Supabase (Auth, Storage, RLS)
- Server Actions / Route Handlers
- Webhooks
- Background Jobs quando necessário
- Observabilidade

### SAAS FASE 1 — Arquitetura (2026-09-16)

- **Multitenancy**: cada empresa cliente da WJB é um `tenant` (`supabase/migrations/0001_core_schema.sql`).
  O time WJB (`profiles.is_wjb_staff = true`) não pertence a nenhum tenant — RLS libera acesso a
  todos via a função `is_staff()`. Usuários de empresas clientes se ligam a um tenant por
  `tenant_members` (papel `owner`/`member`).
- **RBAC**: `staff_role` (`super_admin` | `contador` | `atendimento`) em `profiles`, checado por
  `src/lib/permissions/roles.ts`. Papel dentro de um tenant (`tenant_members.role`) é separado do
  papel de staff.
- **Autenticação**: Supabase Auth (e-mail/senha). Sem autocadastro público — contas são
  provisionadas pelo time WJB no onboarding (SAAS FASE 4), ver `supabase/README.md`.
- **`proxy.ts`, não `middleware.ts`**: esta versão do Next.js (16.3.3) descontinuou e renomeou o
  arquivo de middleware para `proxy.ts` (`node_modules/next/dist/docs/.../file-conventions/proxy.md`).
  `src/proxy.ts` faz só a checagem otimista (redireciona visitante deslogado tentando abrir
  `/portal`/`/admin`) e renova a sessão a cada request — tem um guard explícito que devolve a
  requisição sem tocar em nada quando `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` não estão definidas,
  pra não derrubar o resto do site (V1) enquanto o projeto Supabase real não existe.
- **Data Access Layer**: `src/lib/auth/dal.ts` (`getSession`/`requireSession`/`requireStaffSession`,
  memoizados com `cache()` do React) é a única porta de entrada pra verificar sessão — seguindo o
  padrão que a própria documentação desta versão do Next.js recomenda para projetos novos
  (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`, "Data Access Layer"). O proxy
  nunca é a única linha de defesa; toda Server Action/página sensível chama a DAL de novo.
- **Clients Supabase** (`src/lib/db/supabase/`): `client.ts` (browser, chave anônima), `server.ts`
  (Server Components/Actions, chave anônima + cookies da sessão, RLS sempre vale), `admin.ts`
  (service role, `server-only`, ignora RLS — só para rotinas administrativas entre tenants).
- **Projeto Supabase real conectado e validado (2026-09-16)**: `wjb-website-app`, região South
  America (São Paulo), organização "wjb assessoria contabil". `.env.local` preenchido (fora do
  Git). Fluxo completo testado de ponta a ponta no navegador: login com usuário real → redirect
  pro `/admin` (papel `super_admin` exibido) → logout → `/admin` sem sessão redireciona pro
  `/login?next=/admin` (proxy funcionando). Esse projeto usa o sistema novo de chaves do Supabase
  (**Publishable/Secret key**, não o `anon`/`service_role` JWT legado) — funciona como substituto
  direto nas mesmas env vars, sem mudança de código.
  - **Duas pegadinhas reais encontradas e resolvidas**, registradas aqui porque vão se repetir em
    qualquer projeto Supabase novo criado por este time:
    1. **Tabelas criadas via SQL Editor não aparecem na Data API** (`PGRST205: Could not find the
       table 'public.X' in the schema cache`) mesmo com RLS e schema `public` expostos
       corretamente — porque as roles `anon`/`authenticated`/`service_role` não têm `GRANT` nas
       tabelas novas por padrão nesse projeto (mesmo com "Automatically expose new tables"
       ligado). Fix: `migrations/0002_grant_data_api_access.sql` (GRANT explícito + `ALTER
       DEFAULT PRIVILEGES` pra tabelas futuras + `NOTIFY pgrst, 'reload schema'`) — **sempre
       incluir isso em qualquer projeto Supabase novo**, não é específico deste bug.
    2. **`CREATE TYPE` não é idempotente**: uma primeira tentativa de rodar `0001_core_schema.sql`
       falhou no meio (motivo não identificado — possivelmente uma falha pontual de conexão),
       deixando só os 2 `enum` criados e nada mais. Toda tentativa seguinte de rodar o script
       inteiro de novo falhava silenciosamente logo na primeira linha ("type already exists"),
       sem nunca chegar a criar as tabelas — e o painel do Supabase mostra "Success" para
       qualquer statement que rode isoladamente depois, o que mascarou o problema por várias
       rodadas de diagnóstico (schema exposto? sim. GRANT aplicado? sim. Restart do projeto?
       sim. Nada disso resolvia porque a causa raiz nunca tinha rodado). Resolvido com `DROP TYPE
       IF EXISTS ... CASCADE` antes de re-rodar. **Lição**: se uma migration falhar no meio do
       caminho, sempre verificar o que already existe (`pg_type`/`pg_proc`/`pg_tables`) antes de
       simplesmente rodar o script inteiro nível de novo — script não é idempotente por padrão.
  - **Usuários de teste** criados via `service_role` — úteis pra continuar testando manualmente,
    **remover (ou trocar senha) antes de qualquer coisa ir pra produção real**:
    `teste-staff@wjbassessoriacontabil.com.br` (`is_wjb_staff: true`, `staff_role: super_admin`),
    `dono-teste@wjbassessoriacontabil.com.br` (owner de "Empresa Teste LTDA"),
    `colega-teste@wjbassessoriacontabil.com.br` (member da mesma empresa),
    `super-admin-e2e@wjbassessoriacontabil.com.br` (criada pra testar Usuários/staff em
    2026-09-16, já rebaixada — `is_wjb_staff: false` — mas não pôde ser apagada, ver bullet
    "Usuários (staff)" mais abaixo), `ticket-client-e2e@wjbassessoriacontabil.com.br` (member de
    "Empresa Teste LTDA") e `ticket-staff-e2e@wjbassessoriacontabil.com.br` (também já
    rebaixada) — as duas últimas criadas pra testar Tickets, mesma limitação de FK impedindo
    apagar, ver bullet "Tickets" mais abaixo. Mesma coisa de novo pra Mensagens:
    `msg-client-e2e@wjbassessoriacontabil.com.br` (member) e
    `msg-staff-e2e@wjbassessoriacontabil.com.br` (já rebaixada), ver bullet "Mensagens". E de
    novo pra Calendário/Notificações: `cal-client-e2e@wjbassessoriacontabil.com.br` (member) e
    `cal-staff-e2e@wjbassessoriacontabil.com.br` (já rebaixada), ver bullet "Notificações".
    Mesma coisa pro Pentest da FASE 6: `sec-staff-e2e@wjbassessoriacontabil.com.br` (já
    rebaixada) — a conta de cliente dessa rodada (`sec-client-e2e@...`) **conseguiu ser apagada**
    de verdade (não gerou nenhuma linha em `audit_log`/`ticket_messages`/`messages`, então não
    tinha FK travando), ver bullet "Pentest".
  - **Terceira pegadinha, mais séria**: testar a criação de empresa pelo Admin WJB pela primeira
    vez (ver bullet "Admin > Empresas + convite" abaixo) revelou um bug real de **recursão
    infinita de RLS** (`42P17`) — a policy de SELECT de `tenant_members` fazia um self-join na
    própria tabela dentro do `USING`, e como a policy de `tenants` também consulta
    `tenant_members`, qualquer leitura de `tenants` (inclusive o `.select()` implícito após um
    `INSERT`) disparava a recursão. Corrigido em `0003_fix_tenant_members_rls_recursion.sql` com
    duas funções `SECURITY DEFINER` (`my_tenant_ids()`, `is_tenant_owner()`) — mesmo padrão do
    `is_staff()` já usado desde a FASE 1. **Lição**: nunca fazer uma policy de RLS consultar a
    própria tabela via subquery direta — sempre passar por uma função `SECURITY DEFINER`, mesmo
    quando "parece" seguro à primeira vista.
- **Admin WJB > Empresas + convite de usuário** (2026-09-16, primeira fatia real da SAAS FASE 2 +
  FASE 4, testada de ponta a ponta no navegador): `/admin/empresas` (lista + criar empresa,
  `src/actions/tenants.ts#createTenant`) e `/admin/empresas/[id]` (detalhe + lista de membros +
  convidar pessoa, `src/actions/tenants.ts#inviteMember`). Convite usa
  `supabase.auth.admin.inviteUserByEmail()` — e-mail nativo do Supabase Auth, não depende da
  integração de e-mail transacional da SAAS FASE 5 (que é para outro tipo de mensagem). Se o
  e-mail já tem profile (já é membro de outra empresa, por exemplo), só vincula, sem reenviar
  convite. Novo fluxo `/auth/callback` (troca o `code` do link de e-mail por sessão real, fluxo
  PKCE) → `/definir-senha` (convite e recuperação de senha compartilham essa tela). `/portal`
  passou a mostrar a(s) empresa(s) reais do usuário (via `tenant_members`, respeitando RLS) em
  vez do texto genérico "em construção". `audit_log` finalmente recebe linhas de verdade
  (`tenant.created`, `tenant_member.invited`).
  - Testado com uma empresa fictícia ("Empresa Teste LTDA") e o próprio usuário de teste como
    membro — **ambos ficam no banco real até a limpeza pré-produção.**
- **Storage — fecha a SAAS FASE 1** (2026-09-16): bucket privado `documents`
  (`supabase/migrations/0004_storage_documents.sql`), convenção de caminho
  `{tenant_id}/{arquivo}`, RLS igual ao resto do produto (staff vê/edita tudo; membro só
  lê/envia dentro da própria empresa; editar/apagar é só staff). Helpers em
  `src/lib/storage/documents.ts` — infraestrutura pronta, mas **ainda sem UI de "Documentos"**
  (isso é a SAAS FASE 2). Testado de ponta a ponta com o usuário de teste autenticado (não via
  service role) — upload, list e delete respeitando RLS de verdade.
  - **Quarta pegadinha real do Supabase**: `insert into storage.buckets` seguido de
    `alter table storage.objects enable row level security` na mesma submissão do SQL Editor
    falhou com `42501: must be owner of table objects` (o usuário do SQL Editor não é dono
    daquela tabela interna) — e como o SQL Editor roda cada clique em Run como **uma transação
    só**, o `insert` do bucket foi desfeito junto (rollback), mesmo o bucket "parecendo" criado
    até então. **Lição**: `storage.objects` já vem com RLS habilitada por padrão no Supabase —
    nunca tentar rodar esse `ALTER TABLE`; e depois de qualquer erro no meio de um script,
    verificar o que sobreviveu antes de assumir que os passos anteriores da mesma submissão
    ficaram de pé.
- **Documentos** (2026-09-16, primeiro conteúdo real do Portal do Cliente além da empresa):
  tabela `documents` (`supabase/migrations/0005_documents_table.sql`, metadados — nome, quem
  enviou, tamanho — apontando pro arquivo real no bucket `documents` da FASE 1) com o mesmo
  padrão de RLS do resto do produto. `/portal/documentos` e a seção "Documentos" dentro de
  `/admin/empresas/[id]` compartilham `UploadDocumentForm` e `DocumentsList`
  (`src/components/documents/`) — só a prop `canDelete` muda (true só no Admin). Link de
  download é sempre uma signed URL de 10 minutos (`src/lib/documents.ts`), nunca uma URL
  pública, já que o bucket é privado.
  - Testado de ponta a ponta no navegador nos dois sentidos: staff envia documento no Admin →
    cliente vê e baixa no Portal; cliente envia documento no Portal → aparece no Admin; staff
    apaga (cliente não tem esse botão, por RLS e por a UI nem renderizar).
- **Usuários no Portal do Cliente** (2026-09-16): `/portal/usuarios` mostra os colegas da própria
  empresa (`src/components/tenant/members-list.tsx`, extraído do que já existia em
  `/admin/empresas/[id]`) e deixa o `owner` da empresa convidar gente nova sozinho — antes só
  staff podia convidar. `requireTenantAccess()` (novo em `src/lib/auth/dal.ts`) generaliza o
  guard "staff ou membro daquele tenant" pra qualquer Server Action ligada a uma empresa
  específica.
  - **RLS aberta pro owner** (`0006_tenant_owner_can_invite.sql`): a policy única
    `tenant_members_write_staff_only` (`for all`) virou três policies separadas — `insert`
    libera `is_staff() or is_tenant_owner(tenant_id)`, `update`/`delete` continuam só staff
    (mais sensível — evita um owner se trancar fora ou remover alguém sem supervisão). A Server
    Action (`inviteMember`) troca `requireStaffSession()` por `requireTenantAccess(tenantId)` +
    checagem de papel — reforço em camadas, a RLS já bloqueia sozinha mesmo que a Action tivesse
    um bug.
  - **Bug real encontrado no teste**: com o dono logado, `/portal/usuarios` mostrava "—" no lugar
    do nome/e-mail de cada colega (só o próprio nome aparecia certo). Causa: a policy de SELECT
    de `profiles` só libera ver o próprio perfil (ou staff ver todos) — o embed
    `tenant_members.select("...profiles(full_name, email)")` do Supabase retorna `null` quando a
    RLS bloqueia a linha relacionada, em vez de dar erro, o que quase escondeu o problema.
    Corrigido com uma policy adicional em `profiles` (0007, permissiva — soma com a existente via
    OR): também pode ver o profile de quem é colega em algum tenant em comum
    (`0007_profiles_visible_to_tenant_colleagues.sql`).
  - Testado de ponta a ponta com um usuário dono real (não staff, criado só para o teste): viu os
    3 colegas com nome/e-mail certos, convidou um quarto pela UI (criou conta nova via
    `inviteUserByEmail`), e confirmei via script que um membro comum (não owner) apanha
    `42501: new row violates row-level security policy` ao tentar o mesmo insert direto — a RLS
    protege mesmo se a UI/Action tivesse alguma falha.
- **Obrigações** (2026-09-16): tabela `obligations` (`0008_obligations_table.sql`) — diferente de
  Documentos (bidirecional), aqui só a WJB escreve (`obligations_write_staff_only`, `for all`
  restrito a `is_staff()`); o cliente só lê. `ObligationsList`
  (`src/components/obligations/`) calcula o badge (Pendente/Concluída/Atrasada) no servidor a
  partir de `due_date` e `status` — "Atrasada" nunca é um valor gravado no banco, só uma
  derivação de exibição (evita ficar desatualizado se ninguém abrir a tela no dia exato em que
  vence). `/portal/obrigacoes` reaproveita o mesmo componente sem a prop `canManage`, que
  esconde os botões "Concluir"/"Reabrir"/"Apagar".
  - Testado de ponta a ponta no navegador: staff cria duas obrigações (uma futura, uma com
    vencimento passado) → badges "Pendente" e "Atrasada" corretos, ordenadas por vencimento →
    marca a primeira como concluída (badge muda pra "Concluída", botão vira "Reabrir") → cliente
    vê as duas no Portal, sem nenhum botão de gerenciar.
- **Guias + Dashboard — fecha a SAAS FASE 2** (2026-09-16): "Guias" (DAS, DARF etc.) virou uma
  **categoria dentro de Documentos** em vez de tabela nova (`0009_document_category.sql`, coluna
  `category` com `check (category in ('documento', 'guia'))`) — mesma infraestrutura de
  Storage/RLS, só filtra por categoria (`listTenantDocuments(tenantId, category)`).
  `/portal/documentos` e `/portal/guias` são a mesma UI (`DocumentsList`/`UploadDocumentForm`)
  com `category` fixo diferente; `/admin/empresas/[id]` ganhou uma segunda seção "Guias" ao lado
  de "Documentos". `/portal` virou um dashboard de verdade
  (`getTenantDashboardStats()` em `src/lib/tenant.ts`, contagens reais via `count: "exact", head:
  true` — nunca um número inventado, seção 43): obrigações pendentes/atrasadas, total de
  documentos/guias/pessoas na empresa.
  - Extraído `getMyPrimaryTenant()` (`src/lib/tenant.ts`) — a mesma query de "qual é a empresa
    deste usuário" estava duplicada em 3 páginas (`documentos`, `obrigacoes`, `usuarios`); agora
    é uma função só, reaproveitada também pelo dashboard.
  - Testado de ponta a ponta no navegador: dashboard mostra as contagens certas com um documento
    e uma guia real (1 Documento / 0 Guias antes do teste) → envia uma guia pelo
    `/portal/guias` → dashboard atualiza pra 1 Guia, e ela não aparece em `/portal/documentos`
    (separação por categoria confirmada nos dois sentidos).
- **Leads** (2026-09-16): tabela `leads` (`0010_leads_table.sql`) — RLS diferente do resto do
  produto: `insert` é **público** (`with check (true)`, qualquer visitante do site cria um lead
  sem estar autenticado — é o próprio formulário de contato), `select`/`update` só staff.
  `/api/leads` (route handler já existente desde a V1) passou a gravar de verdade em vez de só
  `console.log`; `/admin/leads` lista os últimos 100 e deixa mudar o status
  (Novo/Contatado/Convertido/Perdido) via `LeadStatusSelect` (client component, chama a Server
  Action direto no `onChange`, sem precisar de `<form>`).
  - **Bug real corrigido no caminho**: `NewsletterForm` (rodapé) manda um payload próprio
    (`name: "Newsletter"`, sem `phone`/`serviceInterest`/`consent`), mas `/api/leads` validava
    **todo** envio contra `leadFormSchema` (que exige esses 3 campos) — toda inscrição de
    newsletter falhava a validação e caía no `catch` do form, mostrando "Não foi possível
    assinar agora." sem nenhum log de erro visível. Existia desde a implementação original do
    formulário. Fix: a rota agora detecta `formContext === "Newsletter"` e valida contra
    `newsletterFormSchema` (só `email` + tracking) nesse caso.
  - **Teste unitário precisou de ajuste**: `leads-api.test.ts` importava `POST` da rota, que
    agora importa `@/lib/db/supabase/server` — e esse módulo tem `import "server-only"` no
    topo, um pacote que o Next trata especialmente no build mas que o Vitest não resolve
    (`Failed to resolve import "server-only"`). Fix: alias em `vitest.config.mts` apontando
    `"server-only"` pra um stub vazio (`src/tests/mocks/server-only.ts`), e o teste passou a
    mockar `@/lib/db/supabase/server` inteiro (`vi.mock`) em vez de bater num Supabase real —
    testa validação/roteamento, não persistência (isso é o teste manual de ponta a ponta).
  - Testado de ponta a ponta no navegador: inscrição de newsletter confirma de verdade agora
    (antes falhava) → aparece em `/admin/leads`; lead completo enviado por `/contato` aparece
    com todos os campos certos (nome, e-mail, telefone, assunto, mensagem, página de origem); e
    mudar o status pra "Contatado" persiste depois de recarregar a página.
- **Logs** (2026-09-16): `/admin/logs` (`src/lib/audit-log.ts`) — só leitura das últimas 100
  entradas de `audit_log`, com o nome de quem agiu (`profiles`) e a empresa envolvida (`tenants`)
  já resolvidos via embed, mais uma tradução simples de `action` pra rótulo em PT-BR
  (`tenant.created` → "Empresa criada" etc.) e os campos de `metadata` formatados numa linha.
  Fecha o item que faltava desde a FASE 1 — o `audit_log` vinha sendo alimentado desde então
  (`tenant.created`, `document.uploaded`, `obligation.status_changed`...) sem nenhuma tela pra
  ver.
  - Testado com o histórico real acumulado nesta sessão inteira (dezenas de entradas reais de
    empresa/documento/obrigação/lead) — não precisou de dado de teste novo, só a tela de
    visualização mesmo.
- **Usuários (staff)** (2026-09-16, última fatia da SAAS FASE 4 antes de Tickets):
  `/admin/usuarios` lista o time interno da WJB (`profiles` onde `is_wjb_staff = true`).
  Conceder acesso, trocar papel e revogar são exclusivos de `super_admin` — reforçado tanto na
  UI (`isSuperAdmin(session)` esconde os controles) quanto no banco via
  `0011_super_admin_manages_staff.sql` (nova função `SECURITY DEFINER` `is_super_admin()` +
  policy `profiles_update_super_admin`, mesmo padrão `is_staff()`/`is_tenant_owner()` já usado
  desde a FASE 1). `inviteStaffMember` (`src/actions/staff.ts`) reaproveita o mesmo fluxo de
  `inviteMember` (Empresas): se o e-mail já tem conta (`profiles` por e-mail), só promove
  (`is_wjb_staff: true` + `staff_role`); senão convida via `admin.auth.admin.inviteUserByEmail`.
  `revokeStaffAccess` nunca apaga a conta, só desliga `is_wjb_staff`/`staff_role`, e tem uma
  guarda explícita (`if (profileId === session.userId) return`) contra auto-revogação — sem
  essa guarda um `super_admin` sozinho poderia se trancar fora do próprio Admin sem querer.
  Todas as 3 ações logam em `audit_log` (`staff.invited`/`staff.role_changed`/
  `staff.access_revoked`), consistente com o resto do Admin.
  - **Testado de ponta a ponta no navegador com contas de teste descartáveis**, não com as
    contas de teste antigas documentadas acima — a senha delas tinha se perdido entre sessões
    (compactação de contexto) e resetar a senha de uma conta existente foi bloqueado pelo
    classificador de ações sensíveis do Claude Code ("Credential Exploration"). Criar contas
    **novas** via `service_role` (mesmo padrão já documentado acima para os 3 usuários de teste
    originais) não foi bloqueado — usadas `super-admin-e2e@`/`atendimento-e2e@`/
    `promovido-e2e@wjbassessoriacontabil.com.br`, senha só nesta sessão. Cobriu: conceder acesso
    promovendo um perfil existente (`promovido-e2e`, antes um profile comum sem `is_wjb_staff`)
    — mensagem "Acesso concedido." e pessoa aparece na lista; trocar papel de "Atendimento" pra
    "Contador" via `<select>` — **confirmado persistido de verdade** com reload da página (não
    só otimismo do client); revogar acesso — pessoa some da lista; caso negativo, logado como
    staff `contador` (não `super_admin`) — tela vira só leitura, sem `<select>`/"Revogar", com o
    aviso "Só super_admin pode conceder acesso a novas pessoas."
  - **Pegadinha de teste, não bug de produto**: o primeiro clique em "Revogar" não fez nada —
    o `ref` do elemento (lido via accessibility tree antes de um reload de página) tinha ficado
    obsoleto depois que a página recarregou; clicar de novo nas coordenadas de um screenshot
    fresco funcionou. Mesmo padrão já registrado em sessões anteriores ("ref-based clicks going
    stale after re-render") — sempre re-ler a página ou usar coordenadas de um screenshot atual
    depois de qualquer navegação/reload, nunca reusar um `ref` antigo.
  - Contas de teste `*-e2e@wjbassessoriacontabil.com.br` criadas nesta sessão: `atendimento-e2e`
    e `promovido-e2e` já foram apagadas (`admin.auth.admin.deleteUser`) ao final do teste.
    `super-admin-e2e` **não pôde ser apagada** (erro de FK — é `actor_id` de 3 linhas que ela
    mesma gerou em `audit_log` durante o teste, e `audit_log.actor_id` não tem `ON DELETE
    CASCADE`) — foi rebaixada (`is_wjb_staff: false`, `staff_role: null`) em vez de apagada, e
    entra na mesma lista de limpeza pré-produção abaixo.
- **Dashboard do Portal redesenhado + app shell próprio (`/portal`)** (2026-09-16, mesmo dia,
  usuário forneceu um print de referência de um dashboard de gestão financeira/SaaS — sidebar,
  cards, gráfico de barras, tabela — pedindo pra aplicar esse visual mantendo a identidade da
  WJB): confirmado com o usuário que o alvo era o Dashboard do Portal do Cliente, não o Admin.
  Como a referência usa conceitos de fintech (spend/budget/reconcile) que não existem no WJB, o
  visual foi adaptado — sidebar, cards, gráfico de barras, tabela — mas todo dado é real: 4 cards
  (obrigações pendentes/atrasadas, documentos, guias, pessoas — já existiam), gráfico de
  obrigações por mês (`getObligationsMonthlyBreakdown`, `src/lib/tenant.ts` — 2 meses passados +
  atual + 3 futuros, barra empilhada concluída/pendente a partir de `due_date`/`status` reais,
  **nunca uma tendência inventada** — meses sem obrigação aparecem com 0, não somem), card de
  "Cumprimento do mês" (% concluído no mês atual, real, deriva do mesmo bucket mensal), tabela
  "Documentos por categoria" (`getDocumentsCategorySummary` — contagem + último envio de
  Documentos/Guias) e "Próximas obrigações" (`getUpcomingObligations` — as 5 mais próximas por
  `due_date`, atrasadas aparecem primeiro por ordenação natural). Nenhum widget novo foi
  inventado sem contrapartida real — "Recent Activity" da referência foi descartado porque
  `audit_log` é staff-only por RLS (`audit_log_select_staff_only`, FASE 1); "Próximas
  obrigações" ocupa o mesmo espaço visual com conteúdo que o cliente de fato pode ver.
  - **`/portal` virou um app shell de verdade** (sidebar fixa no desktop, gaveta com foco
    trapado no mobile — `src/app/portal/layout.tsx` + `src/components/portal/portal-mobile-nav.tsx`,
    mesmo padrão de scroll-lock/Escape/Tab-trap do menu mobile de marketing) em vez de herdar o
    header com mega menu e o rodapé institucional da V1 — não fazia sentido repetir navegação de
    visitante/lead atrás da própria navegação do Portal.
  - **Erro real cometido e corrigido ainda na mesma tarefa**: a primeira versão escondia o
    header/footer/Assistente Virtual dentro do próprio `RootLayout`, decidindo via
    `headers().get("x-pathname")` (novo header setado pelo proxy, `x-pathname`, padrão oficial do
    Next pra um Server Component saber a rota atual sem virar Client Component). Isso **quebrou a
    geração estática de toda a V1** — usar uma API dinâmica (`headers()`) na raiz que embrulha
    literalmente toda rota do site marca o site inteiro como dinâmico (`ƒ`), não só `/portal`; o
    `next build` confirmou isso na hora (todas as ~40 páginas de marketing, antes `○`/`●`
    estáticas, viraram `ƒ`). Só percebido porque o hábito de sempre rodar `npm run build` e
    conferir a tabela de rotas antes de dar qualquer coisa por pronta pegou a regressão antes do
    commit. **Fix**: Route Groups do Next (`src/app/(site)/`, contém tudo que é marketing +
    `/admin` — mesmo header/footer de sempre, sem redesenho pedido ainda — com seu próprio
    `(site)/layout.tsx` renderizando `SiteHeader`/`SiteFooter`/`WJBAssistant`/`JsonLd`; `/portal`
    ficou fora do grupo, com o app shell próprio) — parênteses no nome da pasta não mudam a URL
    (`(site)/sobre/page.tsx` continua sendo `/sobre`), só separam a árvore de layout. O
    `RootLayout` voltou a ser síncrono e sem nenhuma API dinâmica (só `SkipLink`,
    `CookieConsentBanner`, `AnalyticsLoader` — nenhum dos dois usa `headers()`/`cookies()` no
    server). `not-found.tsx` (boundary global de 404) precisou ficar **fora** do grupo por
    convenção do Next (só a raiz de `app/` garante pegar qualquer rota não batida por nenhum
    segmento) — importa `SiteHeader`/`SiteFooter`/`WJBAssistant` direto, sem herdar do grupo.
    Confirmado depois do fix: `next build` voltou a mostrar as páginas de marketing como
    `○`/`●` (estático/SSG) e só `/admin`, `/portal/*` e as rotas que já dependiam de sessão
    continuam `ƒ` (dinâmico) — exatamente como antes desta mudança. **Lição**: qualquer API
    dinâmica usada no `RootLayout` (que embrulha o app inteiro) se propaga pra toda rota, mesmo
    uma que nunca precisaria — decisões de chrome por seção do site pertencem a um Route Group
    com layout próprio, nunca ao layout raiz.
  - Testado de ponta a ponta no navegador (build de produção): logout forçado + login como conta
    de teste descartável (`dashboard-e2e@...`, criada via `service_role` e associada como membro
    da tenant de teste já existente "Empresa Teste LTDA" — sem tocar em nenhuma credencial
    existente, mesma restrição já registrada nos bullets acima sobre reset de senha ser bloqueado
    pelo classificador de ações sensíveis do Claude Code) — sidebar com item ativo destacado
    corretamente, 4 cards batendo com os dados reais da tenant (1 obrigação pendente/atrasada, 1
    documento, 1 guia, 5 pessoas), gráfico mostrando agosto (1 pendente) e setembro (1 concluída,
    mês atual em destaque), card de cumprimento mostrando 1 de 1 (100%), tabela de documentos por
    categoria e lista de próximas obrigações corretas, navegação pela sidebar pra Documentos/
    Guias/Usuários/Obrigações mantendo a mesma sidebar (não volta pro header de marketing),
    logout de volta pro `/login` com header/footer de marketing normais. Conta de teste apagada
    ao final (sem FK pendente desta vez — só entrou como `tenant_member`, não gerou linha de
    `audit_log`).
  - **Não verificado nesta sessão**: comportamento visual real em viewport mobile — a ferramenta
    de automação de navegador (`resize_window`) não surtiu efeito no viewport capturado por
    screenshot (mesma flakiness do Claude em Chrome já documentada nesta sessão em outros
    pontos). A responsividade segue os mesmos breakpoints/padrões já testados em produção no
    resto do site (`lg`/1024px pra sidebar fixa vs. gaveta mobile, `grid-cols-2` nos cards,
    `overflow-x-auto` na tabela) — recomendo uma conferência visual manual num celular real ou
    DevTools antes de considerar 100% validado.
    - **Atualização, mesmo dia, feature de Tickets logo abaixo**: por acaso a janela do Chrome
      de automação abriu em 609×757 (bem próximo de um celular) durante aquele teste seguinte —
      confirma visualmente que a sidebar vira gaveta com hambúrguer, os cards do dashboard
      ficam em 2 colunas e o gráfico/tabelas não estouram a largura. Não substitui um teste
      dedicado num viewport de celular real, mas reduz a incerteza do bullet acima.
- **Tickets** (2026-09-16, mesmo dia — fecha a SAAS FASE 4 por completo e abre a SAAS FASE 3):
  mesma feature vista dos dois lados — cliente abre/acompanha em `/portal/suporte`
  (`/portal/suporte/[id]` pra thread), qualquer papel de staff responde/muda status em
  `/admin/tickets`. Modelo de dados é `tickets` + `ticket_messages` (thread), diferente de
  Obrigações (só staff escreve) — aqui as duas pontas conversam
  (`0012_tickets.sql`): `tickets` (`subject`, `status` enum `open`/`in_progress`/`closed`) e
  `ticket_messages` com `tenant_id` **desnormalizado** de propósito (mesmo racional de sempre —
  RLS nunca faz join/subquery em outra tabela, só coluna própria ou função `SECURITY DEFINER`).
  RLS: `tickets`/`ticket_messages` seguem o padrão de Obrigações (`is_staff() or tenant_id in
  my_tenant_ids()` pra ler/escrever mensagem), mas mudar `status` é exclusivo de staff
  (`tickets_update_status_staff_only`) — o cliente não fecha um chamado sozinho. Usa
  `canHandleSupport()` (`src/lib/permissions/roles.ts`) pela primeira vez — já existia desde a
  FASE 1 mas nunca tinha sido consumida; libera os 3 papéis de staff (não só
  super_admin/contador, diferente de Obrigações) porque qualquer atendente pode responder
  suporte.
  - **Bug real encontrado testando de ponta a ponta, não em revisão de código**: a resposta de
    um staff aparecia como "Pessoa sem nome" pro cliente. Causa: `listTicketMessages` embute
    `profiles(full_name, is_wjb_staff)`, e a policy de SELECT de `profiles` só libera ver o
    próprio perfil, colegas de tenant (`profiles_select_tenant_colleagues`,
    `0007_profiles_visible_to_tenant_colleagues.sql`) ou staff vendo todo mundo — **staff não é
    `tenant_member` de nenhuma empresa**, então nenhuma policy cobria "cliente vendo o perfil de
    um staff". Mesma classe de bug do `0007` (embed do Supabase volta `null` quando a RLS
    bloqueia a linha relacionada, silenciosamente — nunca um erro visível). Fix
    (`0013_profiles_visible_staff_to_tenants.sql`): policy adicional, qualquer usuário
    autenticado pode ver o profile de quem é staff (`is_wjb_staff = true`) — não é dado
    sensível, é literalmente "quem do time WJB está te atendendo".
  - **Segundo bug real, mais simples**: `tickets-list.tsx` mostrava "2 mensagemns" (concatenação
    errada de `"mensagem" + "ns"` pro plural) — trocado por um operador ternário direto
    (`"mensagem"`/`"mensagens"`). Pego no mesmo teste de ponta a ponta, não teria aparecido em
    lint/typecheck/testes automatizados (é só uma string errada, sintaticamente válida).
  - Componentes compartilhados entre Portal e Admin, mesmo padrão de Documentos/Obrigações:
    `TicketsList` (parametrizado por `tenantId?`/`basePath`/`showTenant`), `TicketThread`
    (parametrizado por `canManageStatus`). Mensagens de staff têm fundo azul claro + tag "(WJB)"
    e ficam alinhadas à esquerda; mensagens do cliente ficam à direita — mesmo padrão visual de
    um chat, confirmado visualmente no teste.
  - Testado de ponta a ponta no navegador com duas contas de teste descartáveis (cliente
    associado à tenant de teste já existente, staff com papel `atendimento` — de propósito, não
    `super_admin`, pra confirmar que `canHandleSupport()` realmente libera os 3 papéis): abrir
    chamado → aparece pro staff em `/admin/tickets` com nome da empresa → staff responde e muda
    status pra "Em andamento" → cliente vê a resposta (com o fix) e o novo status → cliente
    responde de volta → staff marca "Resolvido" → formulário de resposta some dos dois lados,
    vira aviso "chamado resolvido" (cliente não vê a dica "mude o status pra reabrir", só o
    staff vê). Contas de teste **não puderam ser apagadas** (erro de FK — `tickets.created_by`/
    `ticket_messages.author_id` não têm `ON DELETE CASCADE`, mesma limitação já documentada em
    bullets anteriores) — a de staff foi rebaixada (`is_wjb_staff: false`), a de cliente ficou
    como membro comum da "Empresa Teste LTDA" (mesma categoria dos outros membros de teste já
    listados na lista de limpeza pré-produção acima).
- **Mensagens** (2026-09-16, mesmo dia — segundo item da SAAS FASE 3): antes de construir,
  perguntei ao usuário o que deveria diferenciar isso de Tickets (o documento mestre só lista o
  nome, sem detalhar) — confirmado: um canal informal e contínuo, sem assunto/status, "fale com
  seu contador a qualquer momento", em vez de duplicar o fluxo formal de chamado. Modelo mais
  simples que tickets: uma tabela só, `messages` (`0014_messages.sql`, `tenant_id`, `author_id`,
  `body`) — **uma única conversa por empresa** (não por assunto), então não precisa da estrutura
  `tickets` + `ticket_messages` de duas tabelas. RLS idêntica a `tickets`/`ticket_messages`
  (`is_staff() or tenant_id in my_tenant_ids()` pra ler/escrever), sem policy de "mudar status"
  porque não existe status pra mudar — as duas pontas sempre podem escrever, sem restrição.
  - `/portal/mensagens` mostra a conversa direto (sem lista prévia — o cliente só tem a própria
    empresa, então não há "qual conversa" pra escolher, diferente do Admin). `/admin/mensagens`
    lista **todas as empresas cadastradas** (`listConversations()`, `src/lib/messages.ts`), não
    só as que já têm mensagem — staff pode puxar conversa primeiro com uma empresa muda;
    ordenadas por última atividade (mais recentes primeiro), empresas sem nenhuma mensagem ficam
    no fim, por nome. `/admin/mensagens/[tenantId]` é a thread, mesmo componente
    `MessageThread` reaproveitado dos dois lados (Portal e Admin), mesmo padrão de
    Documentos/Obrigações/Tickets.
  - **De graça, sem precisar de fix novo**: a resposta de um staff já apareceu com o nome certo
    de primeira no teste — a policy `profiles_select_staff_visible_to_authenticated`
    (`0013_profiles_visible_staff_to_tenants.sql`, corrigida hoje mais cedo pra Tickets) já
    cobria esse caso também, já que é sobre `profiles.is_wjb_staff`, não sobre uma tabela
    específica. Confirma que aquele fix foi na camada certa (RLS de `profiles`), não um
    band-aid específico de Tickets.
  - Testado de ponta a ponta no navegador com duas contas de teste descartáveis novas (mesmo
    padrão dos bullets anteriores — reset de senha de conta existente continua bloqueado pelo
    classificador de ações sensíveis do Claude Code): cliente manda a primeira mensagem →
    aparece pro staff em `/admin/mensagens` com contagem "1 mensagem" e a data → staff clica na
    empresa, responde → cliente vê a resposta com nome + tag "(WJB)". Mesma limitação de FK
    impedindo apagar as contas de teste ao final (`messages.author_id` sem `ON DELETE CASCADE`)
    — staff rebaixada, cliente ficou como membro comum.
- **Calendário** (2026-09-16/17 — terceiro item da SAAS FASE 3): visão mensal das obrigações
  fiscais, sem tabela nova — reaproveita `obligations` (`due_date`/`status`) já existente.
  `getObligationsForMonth(tenantId, year, month)` (`src/lib/obligations.ts`) filtra por
  `due_date` dentro do mês. Componente `ObligationsCalendar` (server component,
  `src/components/obligations/obligations-calendar.tsx`) é compartilhado entre Portal
  (`/portal/calendario`, página própria) e Admin (nova seção "Calendário" dentro do detalhe da
  empresa, `/admin/empresas/[id]`, ao lado de Documentos/Guias/Obrigações) — mesmo padrão de
  reuso já usado em Documentos/Obrigações/Tickets. Navegação de mês anterior/próximo via
  `?year=&month=` na querystring, sem nenhum JavaScript de cliente (link `<Link href="?year=..
  &month=..">`, SSR normal) — funciona igual nas duas páginas hospedeiras porque o href é
  relativo, sem precisar saber o próprio path. Grade de 7 colunas (Dom-Sáb, convenção BR) com
  o dia atual destacado em círculo azul e cada obrigação do dia numa pastilha colorida por
  status (pendente/atrasada/concluída, mesmas 3 cores de sempre).
- **Notificações** (2026-09-17 — último item da SAAS FASE 3, fecha a fase inteira): centro de
  avisos in-app — deliberadamente **não** é o item "E-mail" da SAAS FASE 5 (esse é sobre um
  provedor de e-mail transacional externo, ainda não confirmado); isto aqui é só uma caixa de
  avisos dentro do próprio site, sem depender de nada externo. Tabela nova `notifications`
  (`0015_notifications.sql`): `recipient_id`, `tenant_id`, `type`, `body`, `link`, `read_at` —
  **uma linha por destinatário**, nunca uma linha "global" compartilhada (cada pessoa lê e marca
  como lida só a própria cópia). RLS: `recipient_id = auth.uid()` pra select e update, **sem
  nenhuma policy de insert pra `authenticated`** — de propósito, porque inserir uma notificação
  pra OUTRA pessoa (o fan-out) nunca deveria passar pela RLS de quem disparou o evento; só
  acontece via `createAdminClient()` (service_role) dentro das próprias Server Actions de
  Tickets/Mensagens, que já passaram pela autorização de verdade
  (`requireTenantAccess`/`requireStaffSession`).
  - `notifyTicketOrMessageEvent()` (`src/lib/notifications.ts`) é o fan-out: se quem agiu é
    staff, notifica todos os `tenant_members` daquela empresa (link pro Portal); se quem agiu é
    o cliente, notifica todo o time WJB (`profiles` com `is_wjb_staff = true`, link pro Admin) —
    nunca o próprio autor do evento (filtrado antes do insert). Chamado a partir de 4 pontos já
    existentes: `createTicket`/`replyTicket`/`updateTicketStatus` (`src/actions/tickets.ts`) e
    `sendMessage` (`src/actions/messages.ts`) — nenhuma tabela/action nova além dessas, só um
    `await` a mais em cada uma.
  - `/portal/notificacoes` e `/admin/notificacoes` reaproveitam o mesmo componente
    `NotificationsList` (`src/components/notifications/notifications-list.tsx`) — o destinatário
    é resolvido pela sessão logada dentro de `listNotifications()`, nunca por prop, então o
    mesmo componente funciona nos dois lados sem parâmetro nenhum. Marca tudo como lido
    **depois** de capturar a lista (`markAllNotificationsAsRead()` chamado após o
    `listNotifications()`), pra esta visita ainda mostrar o que estava não lido (destacado com
    uma bolinha azul) — só a próxima carrega tudo já lido.
  - Badge de contagem: sidebar do Portal (`portal/layout.tsx` e `portal-mobile-nav.tsx`, contador
    ao lado do item "Notificações" + uma bolinha no ícone de hambúrguer mobile) e o card
    "Notificações" da home do Admin (`(site)/admin/page.tsx`) — os dois computam
    `getUnreadNotificationCount()` a cada request (já é uma rota totalmente dinâmica, sem custo
    extra de arquitetura). **Não existe um sino persistente em todo canto do Admin** (diferente
    do Portal, que tem sidebar própria) — `/admin/*` ainda usa o header de marketing
    compartilhado (`(site)/layout.tsx`), e dar a ele um contador global exigiria `headers()` ali
    dentro, repetindo exatamente o erro de tornar todo o site dinâmico já cometido e corrigido
    no bullet do Dashboard do Portal acima. Trade-off aceito: o card na home do Admin já mostra
    a contagem fresca a cada visita, só não persiste durante a navegação por outras páginas do
    Admin.
  - Testado de ponta a ponta no navegador com duas contas de teste descartáveis: cliente abre um
    chamado → staff vê badge "1" no card Notificações do `/admin` → clica, item mostra "Novo
    chamado: '...'" destacado, navega pro ticket certo ao clicar → staff marca o chamado como
    Resolvido → cliente vê badge "1" na sidebar do Portal → item mostra "Chamado '...' agora
    está: Resolvido" → visitar a página zera o badge dos dois lados (confirmado com reload).
    Mesma limitação de FK de sempre impedindo apagar as contas de teste ao final
    (`notifications.recipient_id`/`tickets.created_by` sem `ON DELETE CASCADE`) — staff
    rebaixada, cliente ficou como membro comum.
- **Pentest** (2026-09-17 — primeiro item da SAAS FASE 6, iniciada a pedido do usuário depois de
  perguntar se seguia pra FASE 5 (Integrações, bloqueada por depender de provedor externo ainda
  não escolhido) ou FASE 6): revisão de segurança interna de todas as Server Actions
  (`src/actions/*.ts`) e das policies de RLS das 12 tabelas criadas desde a FASE 1, sem nenhuma
  ferramenta externa — leitura de código sistemática, o tipo de trabalho que dá pra fazer sem
  depender de conta/acesso novo.
  - **Achado real, severidade alta, corrigido**: `replyTicket` (`src/actions/tickets.ts`) tinha
    um IDOR entre empresas. A action recebe `ticketId` e `tenantId` como dois parâmetros
    independentes; a autorização (`requireTenantAccess(tenantId)`) só confirma que o chamador
    pertence à empresa `tenantId` — nunca que o `ticketId` também pertence a ela. Como toda
    Server Action do Next.js é uma URL chamável diretamente (não só um clique na UI — um membro
    comum autenticado pode invocá-la via `curl`/script com qualquer `formData`), um cliente da
    empresa A podia mandar `ticketId` de um chamado da empresa B (sabendo ou adivinhando o UUID)
    junto com o próprio `tenantId` (A, que passa na checagem). O insert gravava uma
    `ticket_messages` com `ticket_id` apontando pro chamado de B mas `tenant_id: A` — invisível
    pro cliente real de B (a policy de select filtra pelo `tenant_id` da própria linha, que ficou
    A) mas **visível pro staff** olhando o chamado de B (staff sempre vê tudo via `is_staff()`),
    como se fosse uma resposta legítima de B. E ainda disparava `notifyTicketOrMessageEvent` com
    o `tenantId` errado, mandando um aviso "nova resposta" real pro time WJB apontando pro
    ticket de B. Nenhum dado de B vazava pro atacante (ele não conseguia ler o chamado de B de
    volta, RLS bloqueava isso normalmente) — o risco era injeção de conteúdo arbitrário
    (spam/phishing/abuso) atribuído a si mesmo dentro da thread de outra empresa, visível ao
    staff.
    - **Fix**: a action agora busca o ticket primeiro, com o client de sessão normal (RLS
      aplicada) — se o chamador não tiver acesso de verdade ao `ticketId`, a query já volta
      vazia e a action recusa com "Chamado não encontrado", antes de qualquer escrita. O
      `tenant_id` usado no insert/audit_log/notificação é sempre o do próprio ticket encontrado,
      nunca o parâmetro. Fluxo legítimo (staff e cliente respondendo o próprio chamado)
      re-testado de ponta a ponta no navegador depois do fix — segue funcionando igual.
  - **Mesmo padrão aplicado por integridade (não por brecha de autorização)** em 4 outras
    actions **staff-only** (`updateTicketStatus`, `toggleObligationStatus`, `deleteObligation`,
    `deleteDocument`) — como só staff chama essas (já vê tudo via RLS de qualquer forma), não
    havia bypass de autorização real, mas um `tenantId`/`storagePath` adulterado ou incorreto
    podia gerar `audit_log`/notificações incorretas, ou (em `deleteDocument`) apagar do Storage
    um caminho que não batia com o documento apagado do banco. As 4 passaram a derivar
    `tenant_id` (e `deleteDocument` também `storage_path`) sempre do próprio registro devolvido
    pela query, nunca de parâmetro vindo do cliente — e como consequência ficaram com assinatura
    mais simples (`toggleObligationStatus(obligationId, nextStatus)`,
    `deleteObligation(obligationId)`, `deleteDocument(documentId)`,
    `updateTicketStatus(ticketId, status)`, todas sem `tenantId`). Componentes chamadores
    (`ObligationsList`, `DocumentsList`, `TicketStatusSelect`/`TicketThread`) atualizados pra
    combinar; `npm run typecheck` pegaria na hora qualquer chamada esquecida com a assinatura
    antiga — confirmado limpo. Re-testado no navegador: concluir/reabrir obrigação, mudar status
    de ticket e responder ticket como staff, todos funcionando iguais a antes.
  - **Auditoria de RLS**: as 12 tabelas com `enable row level security` (`profiles`, `tenants`,
    `tenant_members`, `audit_log`, `documents`, `obligations`, `leads`, `tickets`,
    `ticket_messages`, `messages`, `notifications`, mais `storage.objects` do bucket
    `documents`) foram conferidas uma a uma contra o que o app realmente usa (select/insert/
    update/delete) — nenhuma policy faltando encontrada. As ausências que existem são
    intencionais e já documentadas no código-fonte das próprias migrations (ex.: `documents` não
    tem policy de update porque a regra de produto é "substituir por um novo envio, nunca
    editar"; `tickets`/`ticket_messages`/`messages` não têm delete porque threads são imutáveis;
    `notifications` não tem policy de insert pra `authenticated` de propósito, só service_role).
  - **Revisão de XSS**: único uso de `dangerouslySetInnerHTML` no projeto inteiro é
    `json-ld.tsx`, com `JSON.stringify()` de dado 100% interno (schema Organization), nunca
    conteúdo de usuário — sem risco. Corpo de tickets/mensagens (texto livre de qualquer membro
    de tenant) é sempre renderizado como texto React normal (`{message.body}`), que escapa por
    padrão — sem vetor de XSS armazenado ali.
  - **Revisão de upload/Storage**: bucket `documents` é privado (`public: false`), servido só
    via URL assinada de 10 minutos (`getDocumentSignedUrl`), num domínio do Supabase diferente
    da origem do app — mesmo que alguém subisse um arquivo malicioso (HTML/SVG com script), a
    execução ficaria isolada nessa origem separada, sem acesso a cookies/sessão do app. Não há
    allowlist de tipo de arquivo (qualquer MIME é aceito, só limite de 20MB) — aceitável pro MVP
    dado o isolamento de origem já existente; documentado aqui como possível endurecimento
    futuro, não implementado agora pra não adicionar complexidade sem um risco real
    correspondente.
  - **Rate limiting**: não estendido das Server Actions de Tickets/Mensagens (diferente do
    `/api/leads`, que já tem limite por IP desde a FASE 6/QA da V1) — decisão deliberada, não
    esquecimento: essas actions exigem sessão autenticada (contas provisionadas pela própria
    WJB, sem autocadastro público), então o vetor de abuso por IP anônimo que justificou o
    limite em `/api/leads` não se aplica da mesma forma aqui. Fica registrado como algo a
    reavaliar se o volume de contas de cliente crescer o suficiente pra abuso interno virar
    risco real.
- **Auditoria conferida + QA (cobertura E2E real do SaaS)** (2026-09-17, mesmo dia — resto da
  SAAS FASE 6 que dá pra fazer sem provedor externo): **Auditoria** — conferido que toda Server
  Action de escrita (`src/actions/*.ts`) já grava em `audit_log`; a única lacuna real é
  login/logout não serem auditados, deliberadamente fora do escopo original (a tabela nasceu pra
  ações de negócio, não eventos de sessão) — não implementado agora, registrado como possível
  extensão futura.
  - **QA**: até este ponto, toda validação de Tickets/Mensagens/Notificações/Calendário/Staff/
    Empresas era manual, com contas descartáveis criadas e apagadas a cada sessão de teste —
    zero cobertura automatizada. Criadas duas contas de teste **permanentes** (diferente do
    padrão `*-e2e@...` descartável usado o resto da sessão):
    `e2e-client@wjbassessoriacontabil.com.br` (member de "Empresa Teste LTDA"),
    `e2e-staff@wjbassessoriacontabil.com.br` (super_admin) e
    `e2e-client-tickets@wjbassessoriacontabil.com.br` (segunda conta cliente, ver corrida de
    login abaixo) — credenciais em `.env.local` (gitignored) e template em `.env.example`
    (`E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_CLIENT_TICKETS`/`E2E_TEST_PASSWORD`).
    `playwright.config.ts` carrega `.env.local` via `process.loadEnvFile` (nativo do Node ≥20.6,
    sem precisar da dependência `dotenv`) — em CI (sem esse arquivo) ou numa máquina sem essas
    env vars, os specs que dependem delas pulam sozinhos (`test.skip`) em vez de falhar.
  - Dois specs novos: `src/tests/e2e/portal-auth.spec.ts` (visitante deslogado é redirecionado,
    cliente loga e cai no Portal, staff loga e cai no Admin) e `src/tests/e2e/tickets.spec.ts`
    (fluxo completo: cliente abre chamado → staff responde e resolve → cliente confirma — cobre
    em especial o caminho que teve o IDOR corrigido no bullet do Pentest acima, garantindo que o
    fluxo legítimo continua funcionando depois do fix).
  - **3 bugs reais encontrados rodando esses specs pela primeira vez** (não só bugs de teste):
    1. **Banner de cookies intercepta clique** — fixo no rodapé da tela, ficava por cima de
       botões próximos ao fundo (ex.: "Sair" no rodapé da sidebar do Portal), causando timeout
       de clique. Fix nos testes: `page.addInitScript()` pré-configurando
       `localStorage["wjb-cookie-consent"] = "declined"` antes de qualquer navegação — evita o
       banner aparecer, sem precisar clicar nele em cada teste.
    2. **Lacuna real de acessibilidade**: o textarea de resposta de Tickets
       (`src/components/tickets/reply-form.tsx`) e de Mensagens
       (`src/components/messages/send-message-form.tsx`) não tinham `<label>` nem `aria-label`,
       só `placeholder` — que não é um substituto válido de label (WCAG 2.2, 1.3.1): some assim
       que a pessoa começa a digitar, e nem todo software assistivo usa placeholder como nome
       acessível. Corrigido adicionando `aria-label` nos dois (mesmo texto do placeholder).
       Achado porque `getByLabel()` do Playwright (que só busca `<label>`/`aria-label`, nunca
       placeholder) não encontrava o campo — o teste falhando expôs a lacuna real no produto.
    3. **Corrida entre specs**: com `fullyParallel: true` (padrão do projeto), duas specs
       diferentes logando com a MESMA conta de cliente ao mesmo tempo faziam o Supabase Auth
       rejeitar um dos dois logins concorrentes. Fix: `tickets.spec.ts` usa uma segunda conta
       (`e2e-client-tickets@...`), não a mesma de `portal-auth.spec.ts` — evita a corrida sem
       precisar desligar paralelismo pro resto da suíte (que continua rápida).
  - **Achado de ambiente, não do produto**: rodar a suíte completa (`npx playwright test`, sem
    filtro) travou de verdade por quase 2 horas num teste do `navigation.spec.ts` (mobile,
    "menu mobile abre... e fecha com Escape") — um spec da V1 que nunca foi tocado nesta sessão,
    sem nenhuma relação com o código novo (os hooks `beforeEach`/`addInitScript` dos specs novos
    são escopados ao próprio arquivo, não vazam pra outros). Todos os 31 testes que rodaram antes
    do travamento passaram, incluindo os 4 novos (`portal-auth`/`tickets`, desktop). Mesma classe
    de flakiness de automação de navegador já documentada nesta sessão em outros pontos (com o
    Claude em Chrome) — matado com `pkill`, não investigado a fundo (fora do escopo desta
    tarefa; o spec em si não foi alterado). **Contas de teste descartáveis desta rodada**
    (`sec-client-e2e@.../sec-staff-e2e@...`) já limpas (cliente apagado de verdade, staff
    rebaixada) antes mesmo deste bullet, ver final do bullet "Pentest" acima. Os 4 tickets de
    teste gerados pelas execuções repetidas de `tickets.spec.ts` (assunto começando com
    "Teste E2E ") foram apagados do banco ao final — as contas permanentes continuam ativas de
    propósito, pra próxima vez que a suíte rodar.
  - **Performance**: revisão rápida, sem Lighthouse novo (nada mudou nas páginas de marketing já
    medidas — Performance 96/Acessibilidade 100/Best Practices 96/SEO 100, ver FASE 7 da V1);
    nenhuma regressão nova identificada nas mudanças desta sessão. **Não incluído**: uma
    auditoria de performance dedicada às rotas dinâmicas do SaaS (`/portal/*`, `/admin/*`) —
    Lighthouse contra uma rota autenticada exige mais configuração (cookies de sessão) do que
    coube nesta rodada; fica como próximo passo real, não feito por falta de tempo, não por ser
    desnecessário.
- **Logs (error boundaries) + revisão de performance de código do SaaS** (2026-09-17, mesmo dia,
  resto da SAAS FASE 6 que dá pra fazer sem provedor externo): **Logs** — a seção 38 do documento
  mestre lista `logs` e `auditoria` como itens separados; Auditoria já estava coberta (bullet
  acima), mas o projeto inteiro (V1 + SaaS) nunca teve `error.tsx`/`global-error.tsx` — qualquer
  exceção não tratada em Server/Client Component caía na página de erro padrão do Next (preta,
  fora do Design System), a mesma lacuna que já tinha motivado o `not-found.tsx` customizado na
  V1. Adicionados `src/app/error.tsx` (boundary de qualquer segmento, reusa
  `SiteHeader`/`SiteFooter`/`WJBAssistant` como o `not-found.tsx`, botões "Tentar novamente"
  (`retry()`) e "Voltar para a Home") e `src/app/global-error.tsx` (boundary do próprio
  `layout.tsx` raiz — precisa declarar `<html>`/`<body>` própria e não pode usar `metadata` nem
  os componentes de chrome do site, que dependem de contexto que não existe se o layout raiz
  falhou; importa `./globals.css` direto pra manter a marca mesmo sem o restante da árvore).
  Ambos logam via `console.error(error)` num `useEffect` — não há provedor de logging externo
  confirmado (mesma situação de Monitoramento, ver roadmap), então isso é a infraestrutura de
  logs possível hoje, não uma tela de logs nova (diferente de `/admin/logs`, que é Auditoria de
  negócio, não erro de aplicação).
  - **`retry` em vez de `reset`** (breaking change de treino): a prop pra tentar re-renderizar o
    boundary mudou de nome no Next 16.3 (`reset` ainda existe, mas a documentação atual recomenda
    `retry`, estável desde `v16.3.0` — confirmado em
    `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` antes de
    escrever qualquer código).
  - **Testado manualmente no navegador** (não dá pra cobrir por Playwright sem lançar uma
    exceção real de propósito, o que polui a suíte): criada uma rota temporária
    (`src/app/teste-erro-temp/page.tsx`, `throw new Error(...)`) pra confirmar `error.tsx`
    renderizando certo com o chrome do site + os dois botões funcionando (retry recompila a
    rota, "Voltar para a Home" navega). Pra `global-error.tsx`, adicionado um `throw` temporário
    no próprio `layout.tsx` raiz, confirmado visualmente (fundo com o gradiente da marca, botão
    "Tentar novamente" no estilo do Design System) e revertido — nenhuma das duas alterações
    temporárias ficou no código, confirmado por `git status`/`git diff` limpos antes do commit.
  - **Performance** (completa o "próximo passo real" deixado pendente no bullet anterior — não
    um Lighthouse autenticado, que continua fora do escopo por exigir mais configuração de
    sessão do que coube aqui, mas a revisão de código que estava genuinamente faltando):
    revisados todos os arquivos de `src/lib/*.ts`/`src/actions/*.ts` do SaaS em busca de padrão
    N+1 (query dentro de loop). **Achado real**: `listTenantDocuments`
    (`src/lib/documents.ts`) gerava uma URL assinada por documento dentro de um `for...of`
    sequencial (`createSignedUrl`, um round-trip HTTP ao Storage por linha) — pra uma empresa
    com muitos documentos, isso significava N requisições sequenciais só pra montar a lista.
    Corrigido trocando pro método em lote do próprio SDK (`createSignedUrls`, plural, já
    existente em `@supabase/storage-js` — confirmado em
    `node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts` antes de usar), uma única
    chamada com todos os `storage_path` de uma vez, resultado casado de volta por um `Map`. As
    demais listas do SaaS (`listTickets`, `listConversations`) já seguiam o padrão correto (uma
    segunda query em lote pros dados relacionados, nunca uma por linha) desde que foram escritas
    — não achei outro caso. **Bundle**: os únicos Client Components do SaaS (`ticket-status-
    select`, `create-ticket-form`, `send-message-form`, `reply-form`, `upload-document-form`,
    `create-obligation-form`, `invite-member-form`, `portal-mobile-nav`) importam só primitivos
    de UI já existentes (`Button`/`Input`/`Select`/`Textarea`), hooks nativos do React e ícones
    nomeados do `lucide-react` (tree-shakeable) — nenhuma dependência nova ou pesada
    (bibliotecas de data, editor rico, gráfico) entrou no bundle client-side do Portal/Admin.
- **SAAS FASE 5 — Integrações: E-mail (Resend)** (2026-09-17, mesmo dia — usuário escolheu
  avançar na FASE 5 depois de fechar o que dava pra fazer sozinho na FASE 6). Provider escolhido
  pelo usuário entre as opções cogitadas (Resend/SendGrid/SES, seção 36). Estrutura seguida à
  risca do que `docs/api/integrations.md` já previa (Adapter Pattern, seção 37):
  `src/integrations/email/{types.ts,provider.ts,resend.adapter.ts,templates.ts,index.ts}`.
  `getEmailAdapter()` cai num adapter no-op (só `console.log`, nunca lança) sem
  `RESEND_API_KEY`/`EMAIL_FROM` configuradas — mesmo padrão do `AnalyticsLoader`, nunca quebra
  quem chamou. Dependência nova adicionada de propósito (`resend`, SDK oficial) — primeira vez
  nesta sessão que uma dependência de integração externa real entra no projeto, diferente das
  libs de UI que o projeto evita adicionar sem necessidade.
  - **Dois pontos de disparo**: `notifyTicketOrMessageEvent` (`src/lib/notifications.ts`) —
    além da notificação in-app já existente, busca o `email` de cada destinatário (join com
    `profiles`, antes só buscava o `id`) e envia um e-mail por pessoa em paralelo
    (`Promise.allSettled`, nunca bloqueia nem derruba a Server Action que disparou o evento —
    a linha em `notifications` já foi gravada antes); e `POST /api/leads` — avisa
    `siteConfig.contact.email` a cada lead novo do formulário (deliberadamente não para
    inscrições de newsletter, pra não gerar um e-mail por assinante).
  - **Template inline, sem lib nova**: `templates.ts` monta o HTML do e-mail com tabelas
    (compatibilidade de cliente de e-mail) e a cor da marca (`#194382`) direto em string —
    MJML/React Email seriam dependência nova sem necessidade real pra um único layout simples.
  - **Testado de ponta a ponta sem credencial real** (o usuário ainda não forneceu API key/
    domínio verificado do Resend — ver pendência abaixo): confirmado via `curl` direto em
    `POST /api/leads` que o lead salva normalmente e o adapter no-op loga o assunto/destinatário
    certos; lead de teste apagado do banco depois. Rodado `tickets.spec.ts` (Playwright, conta
    permanente) de ponta a ponta contra o dev server — passou, e o log confirmou um e-mail no-op
    disparado por destinatário real (staff e membros do tenant) a cada evento de status/resposta,
    sem quebrar o fluxo. **Não tentei digitar a senha das contas de teste diretamente no
    navegador via Claude em Chrome** — o classificador de segurança do modo automático bloqueou
    essa ação (materialização de credencial); usei o Playwright (mesmo padrão já estabelecido
    nesta sessão pra E2E) em vez de contornar o bloqueio.
  - **Pendência do lado do usuário**: criar a conta Resend, gerar a API key
    (`resend.com/api-keys`) e verificar o domínio de envio (`resend.com/domains`) antes de
    preencher `RESEND_API_KEY`/`EMAIL_FROM` em produção — sem isso, os e-mails continuam caindo
    no adapter no-op (fallback esperado, não um bug).

## Pendências desta fase

- [ ] Escolher e registrar decisões arquiteturais relevantes em `decisions/`.
- [ ] Grid, espaçamento e iconografia (Lucide Icons) ainda não configurados.
- [ ] Avaliar necessidade de `shadcn/ui` conforme mais componentes base forem precisos.
