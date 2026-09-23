# Roadmap

> Status (atualizado 2026-09-05): **Todas as 7 fases da V1 concluídas e integradas**, com fotografia real, conteúdo institucional final, depoimentos em carrossel, planos com preço real, simulador de honorários em **modo "automatic"** (matriz comercial completa da WJB aprovada e ativa — ver Claude.md), e uma auditoria de contraste (WCAG AA) aplicada em cima de tudo isso (ver punch list abaixo — quase tudo resolvido, resta só o que depende exclusivamente do dono da WJB: fotos da equipe, revisão jurídica formal, links de redes sociais e o plano de hospedagem). Staging e produção (deploy real) dependem do usuário conectar o repositório a um provedor de hospedagem — **decidido em 2026-08-31: será a Hostinger, não a Vercel** (que era a recomendação original da seção 21 do documento mestre) — ver seção "Staging/Produção" abaixo.

Fases completas descritas nas seções 32 (V1) e 34 (SaaS/V2) de [`../../Wjb-Website.md`](../../Wjb-Website.md).

## Versão 1 — Website Responsivo

- [x] FASE 0 — Discovery e Preparação
- [x] FASE 1 — Fundação Técnica e Design System *(projeto Next.js 16, tokens de cor/tipografia aplicados, e grid/espaçamento/iconografia/motion formalizados em `docs/design/design-system.md` na FASE 7)*
- [x] FASE 2 — Navegação e Estrutura Global *(header, mega menu, menu mobile, footer e breadcrumb implementados)*
- [x] FASE 3 — Home *(todas as seções da seção 14 implementadas com dados reais do doc mestre onde existiam; Depoimentos ganhou carrossel completo com fotos reais em 2026-08-31, Planos ganhou preços reais + simulador em 2026-08-30 — ver Claude.md)*
- [x] FASE 4 — Páginas de Serviços *(as 11 landing pages de `/servicos/[slug]` (rota dinâmica, não pastas estáticas — ver Claude.md) mais o hub `/servicos` e um `not-found.tsx` customizado)*
- [x] FASE 5 — Conteúdo e Conversão *(blog com 15 artigos reais (`WJB_Blog_Conteudos_V1.md`, 2026-08-30) organizados em 11 categorias, hub `/conteudos`, formulários de contato/proposta/abrir-empresa/trocar-de-contador com `react-hook-form` + `zod` (`/api/leads`), tracking de UTM e botão de WhatsApp condicional — ver Claude.md)*
- [x] FASE 6 — SEO, Performance e Acessibilidade *(`sitemap.xml`/`robots.txt` reais, redirects 301/308 da seção 20, JSON-LD Organization/Article/BreadcrumbList sem placeholders, Open Graph + title template, `prefers-reduced-motion`. Lighthouse real: Performance 93, Acessibilidade 100, Best Practices 100, SEO 100 — corrigido um contraste real (rodapé) e um console error real (`/area-do-cliente` e `/login` não existiam, agora existem como páginas honestas "em construção", permitidas pela seção 5.1). Falta "SEO local" (depende de endereço real).)*
- [x] FASE 7 — QA e Lançamento da V1 *(o que dá para automatizar está feito — ver checklist detalhado abaixo. Staging/produção dependem do usuário.)*

## FASE 7 — Checklist de QA (seção 32)

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] Testes unitários (Vitest, `npm run test`) — 41 testes: `cn()`, schemas Zod de lead/newsletter, JSON-LD (Organization nunca emite `[CONFIRMAR]`), tracking de UTM, rate limit, motor de preços do simulador (`calculatePrice`, conferido linha a linha contra a planilha oficial).
- [x] Testes E2E (Playwright, `npm run test:e2e`) — 42 execuções (desktop + mobile, Chrome real via `channel: "chrome"`): navegação, mega menu, menu mobile (foco/Escape), formulário de contato (validação + envio), página de serviço, post de blog, 404, Área do Cliente/Login, depoimentos, simulador de honorários (cálculo automático + proposta personalizada).
- [x] `npm run build`
- [x] Links — sitemap só lista rotas reais; Lighthouse confirmou 0 console errors (antes havia 1, de link morto).
- [x] 404 — página customizada, coberta por teste E2E.
- [x] Formulários — `/api/leads` validado por teste de integração (payload válido, inválido, JSON malformado) e E2E.
- [ ] Analytics — nenhum provider confirmado (seção 36). `src/lib/analytics/loader.tsx` é um no-op pronto para plugar um provider real quando escolhido, condicionado a consentimento.
- [x] Consentimento — banner de cookies (LGPD, seção 39) em `src/components/shared/cookie-consent-banner.tsx`, persistido em localStorage, testado manualmente (aceitar/recusar, persiste entre reloads).
- [x] Responsividade — testada em múltiplos breakpoints ao longo de todas as fases; suíte E2E roda em desktop e mobile.
- [x] Segurança básica — CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (`next.config.ts`); rate limit em `/api/leads` (`src/lib/security/rate-limit.ts`, best-effort em memória — ver ressalva no código sobre serverless); validação server-side já existia desde a FASE 5; nenhum secret no código.
- [~] Staging/Produção — provedor definido: **Hostinger** (2026-08-31, decisão do usuário, não Vercel). **Plano confirmado em 2026-09-18: hospedagem com suporte a Node.js** (não VPS, não compartilhada comum) — roda `next start` como processo persistente, necessário porque o site tem rotas dinâmicas (`/api/leads`, `/planos/simulador`, e todo o SaaS V2 sob `/portal`/`/admin`/`/login`). **Migração de DNS de HostGator → Hostinger iniciada pelo usuário em 2026-09-18** (domínio `wjbassessoriacontabil.com.br`, ~45min pra concluir no momento do pedido).
  - **Decisão do usuário em 2026-09-18**: publicar agora só o site institucional (V1) no domínio real — o SaaS V2 (Portal do Cliente/Admin WJB/Login) continua em desenvolvimento (FASE 5 em andamento, FASE 6 sem pentest completo/monitoramento/piloto controlado) e não deve ficar acessível publicamente ainda. Implementado um gate reversível em `src/proxy.ts`: sem `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true`, as rotas `/login`, `/definir-senha`, `/recuperar-senha`, `/portal/*`, `/admin/*` e `/auth/*` respondem 404 (página de marca, não a página de erro genérica do Next), o link "Entrar na Plataforma" some do menu (`src/config/navigation.ts`) e `/login` some do sitemap (`src/app/sitemap.ts`) — nenhum código do SaaS foi apagado, só bloqueado. `.github/workflows/e2e.yml` liga a flag só em CI, pra suíte continuar cobrindo essas rotas. Trocar a env var pra `true` no ambiente de produção da Hostinger religa tudo de uma vez, quando a V2 estiver pronta pra acesso público.
  - **Env vars de produção (atualizado em 2026-09-23)**: configuradas e verificadas em produção — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (leads gravando no banco) e `RESEND_API_KEY`/`EMAIL_FROM` (notificação de lead entregue, confirmada no painel do Resend). Ainda **não** configuradas: `SUPABASE_SERVICE_ROLE_KEY` (só necessária pras ações administrativas, que estão atrás do gate do SaaS) e WhatsApp Business (`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_LEAD_TEMPLATE_NAME`, ver `docs/api/integrations.md`) — checklist completo em `.env.example`.
  - **Regra descoberta na prática (2026-09-23)**: a Hostinger injeta as variáveis do painel só no processo em execução, **não no build**. Como o Next embute `NEXT_PUBLIC_*` durante a compilação, toda leitura desse tipo no servidor precisa ser em runtime — ver `src/lib/db/supabase/env.ts`. Variáveis sem o prefixo (`RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SERVICE_ROLE_KEY`) não têm esse problema.

CI (seção 31) configurado em `.github/workflows/ci.yml` (lint/typecheck/test/build) e `.github/workflows/e2e.yml` (Playwright). **Deploy de Preview automático para PRs (Vercel) não se aplica mais** — a Hostinger não tem esse recurso nativo; se o usuário quiser previews de PR, precisaria ser configurado manualmente (ex.: workflow de deploy próprio), não é automático como seria na Vercel.

## Gate V1 → V2

V2 só inicia com todos os critérios da seção 33 aprovados (site, Design System, responsividade, acessibilidade, SEO, formulários, analytics, redirects, build limpo, produção estável).

## Versão 2 — Plataforma SaaS

> **Início registrado em 2026-09-16**, antes da aprovação formal da V1 (ver "Gate V1 → V2" acima)
> — decisão explícita do cliente, não critério técnico atendido. Stack: Next.js + Supabase
> (Auth, Postgres, RLS), seção 22. Acompanhamento detalhado no roadmap visual (Artifact
> "Roadmap SaaS WJB", republicado a cada avanço real).

- [x] SAAS FASE 1 — Arquitetura *(autenticação, banco, tenants, RBAC, RLS e auditoria
  implementados e **validados de ponta a ponta em 2026-09-16** contra um projeto Supabase real
  — `wjb-website-app`, São Paulo. Supabase Auth (login/logout/recuperar senha via Server
  Actions), schema Postgres com `tenants`/`profiles`/`tenant_members`/`audit_log`
  (`supabase/migrations/0001_core_schema.sql` + `0002_grant_data_api_access.sql`), RLS em todas
  as tabelas, RBAC (`src/lib/permissions/roles.ts`), DAL de sessão (`src/lib/auth/dal.ts`,
  padrão recomendado pela documentação desta versão do Next.js), `proxy.ts` (substituiu
  `middleware.ts`, renomeado nesta versão do Next) protegendo `/portal` e `/admin` — testado no
  navegador: login real → redirect por papel → logout → rota protegida sem sessão redireciona
  pro `/login`. **Fase 100% completa** — Storage fechou por último: bucket privado `documents`
  (`0004_storage_documents.sql`), RLS por tenant, testado com upload/list/delete via usuário
  autenticado real. Quatro pegadinhas reais de configuração do Supabase documentadas em
  `docs/architecture/architecture.md` (GRANT ausente, `CREATE TYPE` não idempotente, recursão de
  RLS, e `storage.objects` não pode/precisa de `ALTER TABLE`).)*
- [x] SAAS FASE 2 — Portal do Cliente *(**completa em 2026-09-16**, todos os 6 itens da seção 34
  com dado real, testados de ponta a ponta no navegador: **Dashboard** (`/portal`, resumo real —
  obrigações pendentes/atrasadas, contagem de documentos/guias/pessoas, nunca número inventado —
  **redesenhado no mesmo dia** com sidebar de navegação própria (app shell, sem o header/mega
  menu/rodapé de marketing), 4 cards de resumo, gráfico de obrigações por mês (2 meses passados +
  atual + 3 futuros, barras empilhadas concluída/pendente), card de cumprimento do mês (%
  concluído, real), tabela de documentos por categoria e lista de próximas obrigações — visual de
  referência trazido pelo usuário (dashboard de gestão financeira), adaptado pra conceitos reais
  do WJB, sem nada de "budget"/"spend" inventado; ver `docs/architecture/architecture.md`),
  **Empresa** (nome/CNPJ/papel via `tenant_members`/RLS), **Usuários** (`/portal/usuarios` —
  colegas reais + `owner` convida gente nova sozinho, sem depender da WJB;
  `0006_tenant_owner_can_invite.sql` + policy nova em `profiles` porque RLS escondia nome dos
  colegas), **Documentos** (`/portal/documentos` — upload/download bidirecional, URL assinada,
  bucket privado), **Obrigações** (`/portal/obrigacoes` — só a WJB cria/gerencia, badge
  Pendente/Concluída/Atrasada calculado pela data), **Guias** (`/portal/guias` — categoria dentro
  de Documentos, não uma tabela nova, `0009_document_category.sql`). **Decisão de 2026-09-16
  ("nenhuma integração de ERP/fiscal externo"), reconfirmada em 2026-09-20 na Fase 0 do
  wjb-saas-mvp, foi revertida em 2026-09-20 na Fase 4 do wjb-saas-mvp**: por instrução explícita
  do usuário, a integração Omie.G-Click passou a ser implementada - ver
  `artifacts/wjb-saas-mvp/fase-4/decisions.md` e `docs/api/integrations.md`.)*
- [x] SAAS FASE 3 — Comunicação *(**completa em 2026-09-16/17**: **Tickets** — ver detalhe na
  FASE 4 abaixo, mesma feature vista dos dois lados. **Mensagens completo**: canal separado de
  Tickets de propósito (esclarecido com o usuário antes de construir) — uma conversa contínua e
  única por empresa, sem assunto nem status, pra falar com a WJB no dia a dia
  (`/portal/mensagens` pro cliente, `/admin/mensagens` lista uma linha por empresa pro staff
  escolher com quem falar, `/admin/mensagens/[tenantId]` a thread). Tabela nova `messages`
  (`0014_messages.sql`), RLS igual a tickets (`is_staff() or tenant_id in my_tenant_ids()` pra
  ler/escrever) mas sem policy de status (não existe status aqui). Reaproveitou de graça o fix
  de RLS de `profiles` que Tickets já tinha corrigido no mesmo dia
  (`0013_profiles_visible_staff_to_tenants.sql`) — testado e a resposta do staff já apareceu com
  nome certo de primeira, sem repetir aquele bug. Testado de ponta a ponta no navegador: cliente
  manda mensagem → aparece pro staff na lista de conversas (com contagem e data da última) →
  staff responde → cliente vê a resposta. **Calendário completo**: visão mensal das obrigações
  fiscais (`/portal/calendario`, e uma seção "Calendário" a mais dentro do detalhe da empresa no
  Admin) — sem tabela nova, reaproveita `obligations` já existente, componente
  `ObligationsCalendar` compartilhado entre Portal e Admin, navegação de mês por querystring
  (`?year=&month=`, sem JS de cliente). **Notificações completo**: centro de avisos in-app
  (`/portal/notificacoes`, `/admin/notificacoes`) — não é o item "E-mail" da FASE 5 (isso é
  outra coisa, envio via provedor externo ainda não confirmado). Tabela nova `notifications`
  (`0015_notifications.sql`, uma linha por destinatário, RLS só a própria pessoa lê/marca como
  lida), eventos reais de Tickets/Mensagens (`ticket.created`, `ticket.replied`,
  `ticket.status_changed`, `message.sent`) disparam um fan-out via client admin pra quem precisa
  saber (staff agindo notifica os membros do tenant; cliente agindo notifica todo o time WJB) —
  nunca o autor do próprio evento. Badge de não lidas na sidebar do Portal e no card do Admin,
  marca tudo como lido ao visitar a página. Testado de ponta a ponta no navegador com duas
  contas de teste descartáveis: cliente abre chamado → aparece badge "1" pro staff → staff
  resolve o chamado → aparece badge "1" pro cliente com o texto certo → visitar a página zera o
  badge dos dois lados.)*
- [x] SAAS FASE 4 — Admin WJB *(**completa em 2026-09-16**: módulo "Empresas" completo —
  `/admin/empresas` lista e cria empresas clientes, `/admin/empresas/[id]` mostra membros e
  convida pessoas para o Portal via `supabase.auth.admin.inviteUserByEmail()` (e-mail nativo do
  Supabase Auth). Testado de ponta a ponta: criar empresa → convidar pessoa → pessoa vê a empresa
  no `/portal`. Também mostra e recebe os documentos e guias da empresa (mesma UI de
  `/portal/documentos`/`/portal/guias`, com botão de apagar exclusivo de staff) e gerencia as
  obrigações fiscais (cria, marca concluída/reabre, apaga — mesma UI de `/portal/obrigacoes`, com
  os controles exclusivos de staff). **Leads completo**: `/admin/leads` lista e permite mudar o
  status (Novo/Contatado/Convertido/Perdido) de todo lead recebido pelos formulários do site
  (contato, proposta, simulador, assistente virtual, newsletter) — antes só validavam e davam
  `console.log`, os leads se perdiam de verdade. **Bug real corrigido no caminho**: a inscrição
  de newsletter do rodapé estava quebrada desde sempre (`/api/leads` validava todo envio contra
  o schema completo de lead, que exige telefone/assunto/consentimento — campos que o formulário
  de newsletter nunca envia — então toda inscrição falhava silenciosamente). Testado de ponta a
  ponta: newsletter confirma inscrição de verdade agora, lead completo do `/contato` aparece no
  Admin com todos os dados, e o status muda e persiste após reload. **Logs completo**:
  `/admin/logs` mostra as últimas 100 entradas do `audit_log` (quem fez, o quê, em qual empresa,
  quando) — só leitura, sem edição. Testado com o histórico real desta sessão (documentos,
  obrigações, convites, leads todos aparecendo certos). **Usuários (staff) completo**:
  `/admin/usuarios` lista o time interno da WJB (`is_wjb_staff = true`) e, exclusivo de
  `super_admin` (`0011_super_admin_manages_staff.sql` — nova função `is_super_admin()` +
  policy `profiles_update_super_admin`), permite conceder acesso a alguém novo (convite nativo
  do Supabase Auth se o e-mail ainda não tem conta, ou promove direto se já tiver — mesmo
  padrão de "Empresas"), trocar o papel (`super_admin`/`contador`/`atendimento`) de quem já é
  staff, e revogar acesso (sem apagar a conta, só desliga `is_wjb_staff`) — com proteção
  explícita contra auto-revogação. Testado de ponta a ponta no navegador com contas de teste
  dedicadas: conceder acesso promovendo um perfil existente, trocar papel (persistiu após
  reload), revogar acesso (pessoa some da lista), e o caso negativo — logado como staff
  `contador` (não `super_admin`), a tela vira só leitura (sem select/Revogar) com o aviso "Só
  super_admin pode conceder acesso a novas pessoas." **Tickets completo** (último item da FASE
  4, e também o primeiro da FASE 3 — mesma feature dos dois lados): `tickets` +
  `ticket_messages` (thread), cliente abre um chamado em `/portal/suporte` e acompanha/responde,
  qualquer papel de staff responde e muda status (Aberto/Em andamento/Resolvido) em
  `/admin/tickets` — `canHandleSupport()` (já existia em `roles.ts`, sem uso até agora) libera
  os 3 papéis de staff, não só super_admin/contador. **Bug real corrigido no caminho**: resposta
  da WJB aparecia como "Pessoa sem nome" pro cliente — RLS de `profiles` não cobria staff
  respondendo (staff não é `tenant_member` de nenhuma empresa), corrigido com policy adicional
  (`0013_profiles_visible_staff_to_tenants.sql`, mesma classe de bug/fix do
  `0007_profiles_visible_to_tenant_colleagues.sql`). Testado de ponta a ponta no navegador: abrir
  chamado → staff responde e muda status → cliente vê a resposta e o novo status → cliente
  responde de volta → staff marca como resolvido → formulário de resposta some pros dois lados,
  vira aviso "chamado resolvido".)*
- [~] SAAS FASE 5 — Integrações *(**E-mail implementado em 2026-09-17** (usuário escolheu avançar
  nesta fase depois de fechar o que dava pra fazer sozinho na FASE 6): provider Resend
  (Adapter Pattern, `src/integrations/email/`, ver `docs/api/integrations.md`). Dois pontos de
  disparo — `notifyTicketOrMessageEvent` manda e-mail além da notificação in-app já existente
  pra cada destinatário com e-mail cadastrado, e `POST /api/leads` avisa
  `siteConfig.contact.email` a cada lead novo (não newsletter). Sem `RESEND_API_KEY`/`EMAIL_FROM`
  (usuário ainda não criou a conta/verificou domínio), cai num adapter no-op que só loga — testado
  de ponta a ponta nesse modo (lead via `curl`, fluxo completo de ticket via `tickets.spec.ts`
  Playwright). **WhatsApp implementado em 2026-09-18**: Meta WhatsApp Business Platform (Cloud
  API) direto, sem BSP (Adapter Pattern, `src/integrations/whatsapp-business/`) — só
  `sendTemplate` (a Cloud API exige template pré-aprovado pra mensagem business-initiated fora da
  janela de 24h). Único ponto de disparo por ora: `POST /api/leads` avisa o WhatsApp principal da
  WJB a cada lead novo, condicionado a `WHATSAPP_LEAD_TEMPLATE_NAME` estar configurada. Notificar
  `notifyTicketOrMessageEvent` por WhatsApp também ficou de fora deliberadamente — exigiria
  telefone por `profile`, campo que não existe no schema hoje. Sem
  `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_LEAD_TEMPLATE_NAME` (usuário ainda
  não criou o app Meta/número/template), cai num adapter no-op que só loga. Automação, Assinatura
  e Cobrança continuam sem provider escolhido. **CRM cancelado pelo usuário em 2026-09-18** —
  item removido do escopo da FASE 5. **Armazenamento também removido no mesmo dia** — já coberto
  pelo Supabase Storage implementado nas FASES 1/2 (bucket privado de documentos com RLS por
  empresa), não é uma integração externa separada. Ver `docs/api/integrations.md`.)*
- [~] SAAS FASE 6 — Segurança e Piloto *(**Pentest iniciado em 2026-09-17**: revisão de segurança
  interna de todas as Server Actions e policies de RLS criadas nas FASES 2-4. Achado real e
  **corrigido**: `replyTicket` tinha um IDOR entre empresas — um membro comum (não staff)
  conseguia, chamando a Server Action direto (ela é só uma URL, não só um clique na UI), injetar
  uma mensagem num chamado de OUTRA empresa (sabendo/adivinhando o UUID do ticket) mantendo o
  próprio `tenantId` como autorização. A mensagem ficava invisível pro cliente dono do chamado
  (RLS filtra pelo `tenant_id` da própria linha) mas visível pro staff, como se fosse uma
  resposta legítima — e ainda disparava uma notificação enganosa. Fix: a action busca o ticket
  primeiro (client com RLS — só retorna se o chamador realmente tiver acesso) e usa sempre o
  `tenant_id` real do ticket, nunca o parâmetro vindo do cliente. Mesmo padrão de
  "nunca confiar num id de tenant vindo do cliente pra um recurso que já existe" aplicado
  também (por integridade, não por brecha de autorização, já que são staff-only) em
  `updateTicketStatus`, `toggleObligationStatus`, `deleteObligation` e `deleteDocument` — as 4
  passaram a derivar `tenant_id` (e `deleteDocument` também `storage_path`) do próprio registro
  no banco. Auditoria completa das 12 tabelas com RLS não achou nenhuma policy faltando em
  relação ao que o app realmente usa. Revisão de XSS (nenhum `dangerouslySetInnerHTML` com
  conteúdo de usuário) e de upload de arquivo (bucket privado, só URL assinada de 10 min, origem
  isolada do Storage) sem achados. **Auditoria conferida** (mesmo dia): todas as Server Actions
  de escrita já logam em `audit_log` — nenhuma lacuna real encontrada, só a extensão opcional de
  auditar login/logout (não feita, fora do escopo original do `audit_log`). **QA — primeira
  cobertura E2E real do SaaS**: até agora todo teste de Tickets/Mensagens/Notificações/
  Calendário/Staff/Empresas era manual (contas descartáveis, cada sessão). Criadas contas de
  teste **permanentes** (`E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_CLIENT_TICKETS`, ver `.env.example`)
  e dois specs Playwright novos (`portal-auth.spec.ts`, `tickets.spec.ts` — login real,
  fluxo completo de chamado incluindo o caminho do IDOR corrigido acima). Rodar esses specs pela
  primeira vez achou 3 bugs reais (não só de teste): (1) o banner de cookies intercepta cliques
  perto do rodapé da tela (ex.: "Sair" na sidebar do Portal) — corrigido pré-configurando o
  consentimento antes de cada teste; (2) o textarea de resposta de Tickets/Mensagens não tinha
  `aria-label` nem `<label>`, só `placeholder` (lacuna real de acessibilidade, WCAG 2.2 — corrigido
  nos dois componentes); (3) duas contas de teste logando ao mesmo tempo (suíte roda com
  `fullyParallel: true`) colidiam no Supabase Auth — resolvido com uma segunda conta de cliente
  dedicada. **Logs** (mesmo dia, 2026-09-17): o site inteiro (V1 + SaaS) nunca teve
  `error.tsx`/`global-error.tsx` — qualquer erro não tratado caía na página de erro padrão do
  Next, fora do Design System (mesma lacuna que já tinha motivado o `not-found.tsx` customizado
  da V1). Criados os dois boundaries (reusam header/footer/Assistente Virtual, botão "Tentar
  novamente" via `retry()` — nome novo da prop desde o Next 16.3, `reset` ainda existe mas não é
  mais o recomendado) com `console.error` no `useEffect` como logging de aplicação (distinto da
  Auditoria de negócio de `/admin/logs`) — não há provedor de logging externo confirmado, então
  isso é a infraestrutura possível hoje. Testado manualmente no navegador (rota + `throw`
  temporários, revertidos depois). **Performance** (completa o pendente do bullet anterior):
  revisão de código de todo `src/lib/*.ts`/`src/actions/*.ts` do SaaS em busca de N+1 — achado
  real em `listTenantDocuments` (uma URL assinada por documento, sequencial, dentro de um loop),
  corrigido com o método em lote do próprio SDK do Supabase Storage (`createSignedUrls`); as
  demais listas já batchavam corretamente. Bundle dos Client Components do SaaS conferido: só UI
  primitiva + hooks nativos + ícones nomeados do `lucide-react`, nenhuma dependência pesada nova.
  Lighthouse autenticado contra `/portal`/`/admin` continua não feito (exige mais configuração de
  sessão do que coube nesta rodada). Monitoramento (bloqueado em provedor externo, mesma situação
  da FASE 5) e Piloto controlado (etapa operacional, não de código) continuam pendentes — únicos
  itens restantes desta fase.)*

## Punch list — conteúdo real ainda pendente

Todas as páginas de navegação já existem (2026-08-30) — nenhuma 404 nos links do header/menu mobile/footer. Conteúdo institucional finalizado no mesmo dia (`WJB_Conteudos_Incompletos_Implementacao_Claude.md`) — o que resta é só o que exige dado/decisão exclusiva do dono da WJB (seção 43):

- [x] `/sobre` — história/propósito/como atuamos/parceria Armel-x com texto real. Só a equipe (fotos + bios) continua institucional/genérica, à espera de fotos reais autorizadas.
- [x] `/planos` — reescrito (2026-08-30, `WJB_Planos_Simulador_Implementacao_Claude.md`; preços atualizados em 2026-09-05): 3 planos com preços de entrada reais e aprovados pela WJB (MEI R$ 120, Simples Nacional R$ 350, Lucro Presumido R$ 700/mês), páginas de detalhe (`/planos/mei`, `/planos/simples-nacional`, `/planos/lucro-presumido`) e simulador de honorários (`/planos/simulador`) já em **modo "automatic"** — valor final calculado com a matriz comercial completa aprovada (atividade, Inscrição Estadual, sócios, empregados, faturamento, adicionais e situações que exigem proposta personalizada).
- [x] `/politica-de-privacidade`, `/termos`, `/cookies` — minuta operacional publicável com dados reais. **Revisão jurídica formal continua recomendada** antes da versão definitiva, especialmente após definição de analytics/CRM/cookies de terceiros.
- [x] `/area-do-cliente`, `/login` — `/area-do-cliente` segue com badge "Em desenvolvimento" e CTAs WhatsApp/e-mail reais para quem não tem login. **Atualizado em 2026-09-16**: `/login` deixou de redirecionar para `/area-do-cliente` — agora é o formulário real de acesso à Plataforma SaaS (SAAS FASE 1, ver seção V2 abaixo).
- [x] Todos os `[CONFIRMAR]` em `src/config/site.ts` — CNPJ, endereço, e-mail, 2 WhatsApp, CRC e responsável técnica (Daniella Santana) reais e centralizados (2026-08-30).
- [x] Fotografia real do manifesto `WJB_Assets_Imagens_V1.md` — Home (7/7, incluindo `home-business-needs`), Contabilidade Digital, Armel-x, Sobre, as 11 páginas de serviço e os 15 posts do blog têm foto real (2026-08-30). Só faltam fotos reais da equipe em `/sobre` (hoje ilustrativa). Ver `docs/design/images.md`.

### Ainda depende exclusivamente do dono da WJB

- [ ] Fotos reais da equipe além de Daniella Santana e Diego Júlio de Barros (ambos com placeholder hoje) + autorização de uso de imagem — quantidade/nomes ainda não definidos pela WJB.
- [ ] Calibração do simulador com 20-30 clientes reais (aba `Calibracao_Clientes` da planilha oficial, ainda vazia) — recomendado, não bloqueante: a matriz já está com status "APROVADO" (benchmark de mercado de SP), calibrar com clientes reais só refina os pesos se algum perfil ficar sub/sobre-precificado.
- [ ] Revisão jurídica formal de Política de Privacidade, Termos e Cookies (minuta operacional já publicável).
- [ ] Provider de analytics/CRM (nenhum confirmado — `AnalyticsLoader` continua no-op).
- [ ] URLs reais de Facebook/Instagram (`siteConfig.social`, 2026-08-31) — ícones já implementados no footer, mas ficam inertes (sem link, opacidade reduzida) até a WJB fornecer as URLs.
- [ ] Conectar a Hostinger para staging/produção (decidido em 2026-08-31 — confirmar plano com suporte a Node.js antes do deploy).

## Pendências da FASE 0

- [x] Compreender o site atual da WJB *(entregue como parte do próprio `Wjb-Website.md`, fornecido pronto pelo usuário — não uma descoberta feita a partir de um site legado)*.
- [x] Mapear conteúdo e URLs existentes (para redirects, seção 20) — ver `next.config.ts` e `docs/product/sitemap.md`.
- [x] Confirmar dados institucionais (ver [`sitemap.md`](./sitemap.md) e seção 42 do documento mestre) — `src/config/site.ts`, 2026-08-30/31.
- [x] Analisar o Design System quando fornecido — `docs/design/design-system.md`.
- [x] Validar benchmark — Contweb (planos/simulador, 2026-08-30) e Hostinger vs. Vercel (hospedagem, 2026-08-31).
- [x] Backlog detalhado por fase — este roadmap.
