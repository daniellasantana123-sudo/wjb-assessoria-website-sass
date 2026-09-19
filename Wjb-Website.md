# WJB Assessoria Contábil — Website & Plataforma Digital

> **Documento mestre do projeto**
>
> Este arquivo define a visão, o escopo, a arquitetura, os padrões de UX/UI, a organização técnica, as fases de desenvolvimento e as regras de evolução do novo ecossistema digital da **WJB Assessoria Contábil**.
>
> Ele deve permanecer na **raiz do repositório GitHub** e funcionar como a principal referência de produto para designers, desenvolvedores e agentes de IA.

---

## 1. Visão do Projeto

A WJB Assessoria Contábil está construindo uma nova presença digital com foco em:

- experiência moderna;
- atendimento humano;
- contabilidade consultiva;
- contabilidade digital;
- tecnologia;
- geração de leads;
- organização;
- segurança;
- acessibilidade;
- performance;
- escalabilidade.

O projeto será desenvolvido em **duas versões evolutivas e independentes**:

### Versão 1 — Website Responsivo

Construção completa do novo site institucional e comercial da WJB.

### Versão 2 — Plataforma SaaS

Construção da plataforma digital para clientes, administradores e equipe WJB.

> **Regra de desenvolvimento:** a Versão 2 não deve ser iniciada antes da conclusão, validação e aprovação da Versão 1.

---

# 2. Objetivo Geral

O novo ecossistema deve transformar a WJB de um site institucional tradicional em uma experiência digital moderna capaz de atender quatro objetivos:

1. **Apresentação institucional**
2. **Aquisição e conversão de clientes**
3. **Relacionamento digital**
4. **Base tecnológica para um futuro SaaS contábil**

O produto deve comunicar:

> **Contabilidade próxima para decisões melhores. Tecnologia para sua empresa ir mais longe.**

---

# 3. Posicionamento

A WJB deve ser percebida como uma empresa:

- humana;
- confiável;
- consultiva;
- clara;
- organizada;
- moderna;
- tecnológica;
- responsável;
- acessível;
- estratégica.

A diferenciação não deve ser baseada exclusivamente em preço.

O posicionamento principal será:

**Contabilidade + relacionamento + tecnologia + clareza para tomada de decisões.**

---

# 4. Empresas do Ecossistema

## WJB Assessoria Contábil

Responsável por serviços:

- contábeis;
- fiscais;
- tributários;
- departamento pessoal;
- societários;
- legalização;
- regularizações;
- consultoria;
- planejamento tributário;
- recuperação tributária quando aplicável;
- reforma tributária.

## Armel-x Tecnologia

Parceira tecnológica responsável, conforme contratação e escopo, por soluções como:

- desenvolvimento web;
- desenvolvimento de software;
- automação;
- APIs;
- integrações;
- inteligência artificial;
- cloud;
- DevOps;
- dados;
- dashboards;
- UX/UI;
- Product Design;
- transformação digital.

> A comunicação deve deixar claro que WJB e Armel-x são entidades independentes quando juridicamente aplicável.

---

# 5. Estratégia em Duas Versões

## 5.1 Versão 1 — Website Responsivo

### Objetivos

- modernizar a presença digital da WJB;
- aplicar UX Design de forma consistente;
- criar arquitetura da informação clara;
- melhorar a experiência mobile;
- apresentar todos os serviços;
- aumentar geração de leads;
- estruturar SEO;
- apresentar a Contabilidade Digital;
- apresentar a parceria WJB + Armel-x;
- preparar a arquitetura técnica para a futura plataforma.

### Não pertence à V1

A V1 não deve implementar:

- dashboard operacional real;
- ERP contábil;
- documentos fiscais reais;
- folha operacional;
- emissão fiscal;
- billing SaaS;
- autenticação multiempresa completa;
- dados contábeis sensíveis;
- painel SaaS administrativo completo.

Pode existir:

- página de Área do Cliente;
- página de Login;
- mockup da futura plataforma;
- redirecionamento para sistema atual;
- componentes reutilizáveis para futura V2.

---

## 5.2 Versão 2 — Plataforma SaaS

A V2 será iniciada somente após aprovação formal da V1.

Objetivos:

- portal do cliente;
- área administrativa;
- multiempresa;
- autenticação;
- RBAC;
- documentos;
- guias;
- obrigações;
- solicitações;
- notificações;
- integrações;
- automações;
- relatórios;
- calendário;
- auditoria;
- gestão de usuários.

---

# 6. Design System

A WJB fornecerá um Design System.

Esse arquivo deverá ser analisado antes da implementação visual definitiva.

## Fonte de verdade

O Design System anexado será a principal referência para:

- cores;
- tipografia;
- espaçamentos;
- grid;
- breakpoints;
- iconografia;
- componentes;
- estados;
- motion;
- acessibilidade.

Não criar um Design System paralelo sem necessidade.

Caso um componente ainda não exista, ele deverá:

1. usar tokens existentes;
2. seguir padrões visuais do sistema;
3. ser documentado;
4. ser reutilizável.

---

# 7. Regra de Border Radius

O padrão visual principal da WJB será:

```css
border-radius: 6px;
```

Aplicar em:

- botões;
- cards;
- inputs;
- selects;
- textareas;
- dropdowns;
- dialogs;
- modais;
- containers interativos.

## Exceções

Pills podem ser utilizadas exclusivamente em:

- badges;
- tags;
- chips;
- filtros compactos;
- status.

Evitar estética excessivamente arredondada.

---

# 8. Princípios de UX Design

O projeto deve seguir:

- hierarquia visual;
- consistência;
- feedback;
- previsibilidade;
- prevenção de erros;
- reconhecimento em vez de memorização;
- redução de carga cognitiva;
- escaneabilidade;
- orientação à tarefa;
- mobile-first;
- acessibilidade;
- velocidade percebida;
- clareza textual;
- progressão natural para CTAs.

Evitar:

- dark patterns;
- navegação escondida;
- excesso de animações;
- elementos sem propósito;
- excesso de blocos concorrendo por atenção.

---

# 9. Acessibilidade

Meta mínima:

**WCAG 2.2 AA**

Implementar:

- HTML semântico;
- landmarks;
- skip link;
- navegação por teclado;
- foco visível;
- contraste adequado;
- aria somente quando necessário;
- labels completos;
- alt text;
- mensagens de erro acessíveis;
- zoom 200%;
- reduced motion;
- targets de toque com no mínimo 44 × 44 px.

---

# 10. Responsividade

Abordagem:

**Mobile First**

Testar pelo menos:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px
```

Nenhuma página pode possuir scroll horizontal causado pelo layout.

---

# 11. Arquitetura da Informação — Website

## Header

- Logo WJB
- Serviços
- Contabilidade Digital
- Soluções
- Planos
- Conteúdos
- Sobre
- Contato
- Área do Cliente
- CTA: Falar com contador
- CTA: Solicitar proposta

---

# 12. Menu Mobile

Usar drawer ou fullscreen menu.

Itens:

- Serviços
- Contabilidade Digital
- Soluções
- Planos
- Conteúdos
- Como funciona
- Sobre
- Dúvidas
- Área do Cliente

### Accordion Área do Cliente

- Entrar na Plataforma
- Acompanhar abertura
- Central de documentos
- Suporte

Requisitos:

- foco controlado;
- Escape fecha;
- body scroll lock;
- `aria-expanded`;
- targets ≥ 44px.

---

# 13. Sitemap — Versão 1

```text
/
├── /servicos
│   ├── /abrir-empresa
│   ├── /trocar-de-contador
│   ├── /contabilidade-completa
│   ├── /fiscal-tributario
│   ├── /departamento-pessoal
│   ├── /legalizacao-societario
│   ├── /planejamento-tributario
│   ├── /recuperacao-tributaria
│   ├── /certidoes-regularizacao
│   ├── /consultoria-contabil
│   └── /reforma-tributaria
├── /contabilidade-digital
├── /solucoes
├── /armel-x-tecnologia
├── /planos
├── /como-funciona
├── /conteudos
├── /blog
│   └── /[slug]
├── /sobre
├── /duvidas
├── /contato
├── /solicitar-proposta
├── /area-do-cliente
├── /login
├── /politica-de-privacidade
├── /termos
├── /cookies
└── /404
```

---

# 14. Home — Arquitetura Visual

```text
Header
↓
Hero
↓
Trust Bar
↓
Escolha o que você precisa
↓
Serviços
↓
Contabilidade Digital
↓
Humano + Tecnologia
↓
Como funciona
↓
Planos
↓
Reforma Tributária
↓
WJB + Armel-x
↓
Depoimentos
↓
Conteúdos
↓
FAQ
↓
CTA Final
↓
Footer
```

---

# 15. Hero

Objetivo:

Em poucos segundos, explicar:

- quem é a WJB;
- o que faz;
- para quem;
- qual o diferencial;
- qual o próximo passo.

Direção de copy:

> **Sua empresa cresce melhor quando você entende os números.**

Subheadline:

> Contabilidade consultiva, atendimento próximo e tecnologia para manter sua empresa organizada, segura e pronta para crescer.

CTAs:

- Falar com um contador
- Conhecer nossos serviços

Link secundário:

- Já sou cliente → Área do Cliente

---

# 16. Serviços

## Contabilidade

- escrituração;
- fechamento mensal;
- balancete;
- balanço;
- DRE;
- diário;
- razão;
- demonstrações;
- conciliações;
- relatórios.

## Fiscal e Tributário

- apuração;
- Simples Nacional;
- Lucro Presumido;
- Lucro Real se efetivamente atendido;
- ISS;
- ICMS;
- IPI;
- PIS/COFINS;
- IRPJ/CSLL;
- SPED;
- obrigações acessórias;
- planejamento;
- reforma tributária;
- regularização;
- recuperação tributária quando aplicável.

## Departamento Pessoal

- folha;
- pró-labore;
- admissões;
- férias;
- rescisões;
- 13º;
- eSocial;
- FGTS Digital;
- encargos;
- suporte.

## Societário e Legalização

- abertura;
- alteração;
- transformação;
- entrada e saída de sócios;
- CNAE;
- endereço;
- registro;
- inscrições;
- certidões;
- baixa.

## Consultoria

- contábil;
- fiscal;
- tributária;
- diagnósticos;
- indicadores;
- processos;
- apoio gerencial.

---

# 17. Contabilidade Digital

Página dedicada:

`/contabilidade-digital`

Apresentar:

- organização digital;
- documentos;
- guias;
- obrigações;
- calendário;
- solicitações;
- notificações;
- relatórios;
- suporte humano;
- futura plataforma.

Não prometer módulos que ainda não existem.

Status permitidos:

- Disponível
- Em implantação
- Planejado

---

# 18. WJB + Armel-x Tecnologia

Página:

`/armel-x-tecnologia`

Estrutura:

1. visão;
2. problema;
3. contabilidade;
4. tecnologia;
5. casos de uso;
6. soluções;
7. processo;
8. CTA.

---

# 19. Formulários

Formulários previstos:

- Contato
- Solicitar proposta
- Abrir empresa
- Trocar de contador
- Diagnóstico
- Newsletter opcional

Campos devem ser validados no cliente e no servidor.

Capturar:

- origem;
- URL;
- UTM Source;
- UTM Medium;
- UTM Campaign.

---

# 20. SEO

Implementar:

- metadata;
- title;
- description;
- canonical;
- sitemap;
- robots;
- Open Graph;
- Schema.org;
- breadcrumbs;
- redirects 301;
- Core Web Vitals;
- SEO local.

## Redirects iniciais

```text
/legal-e-societaria/ -> /servicos/legalizacao-societario
/contabilidade-completa/ -> /servicos/contabilidade-completa
/fiscal-e-tributario/ -> /servicos/fiscal-tributario
/certidoes/ -> /servicos/certidoes-regularizacao
/trabalhista-e-previdenciaria/ -> /servicos/departamento-pessoal
/consultoria/ -> /servicos/consultoria-contabil
```

Antes do go-live, rastrear todo o site atual.

---

# 21. Stack Recomendada — V1

Utilizar versões estáveis atuais.

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui ou componentes acessíveis equivalentes
Lucide Icons
React Hook Form
Zod
Vercel
```

Adicionar dependência somente quando necessária.

---

# 22. Stack Recomendada — V2

```text
Next.js
React
TypeScript
PostgreSQL
Supabase
Supabase Auth
Supabase Storage
Row Level Security
Server Actions / Route Handlers
Webhooks
Background Jobs quando necessário
Observabilidade
```

---

# 23. Estrutura Oficial do Repositório

Estrutura recomendada para GitHub e VS Code:

```text
wjb-assessoria-website/
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       ├── ci.yml
│       ├── lint.yml
│       └── deploy-preview.yml
│
├── .vscode/
│   ├── extensions.json
│   ├── settings.json
│   └── launch.json
│
├── docs/
│   ├── architecture/
│   │   ├── architecture.md
│   │   ├── folder-structure.md
│   │   └── decisions/
│   ├── design/
│   │   ├── design-system.md
│   │   ├── ux-guidelines.md
│   │   └── accessibility.md
│   ├── product/
│   │   ├── roadmap.md
│   │   ├── sitemap.md
│   │   └── user-journeys.md
│   ├── security/
│   │   ├── security.md
│   │   └── lgpd.md
│   └── api/
│       └── integrations.md
│
├── public/
│   ├── brand/
│   │   ├── logos/
│   │   ├── icons/
│   │   └── favicons/
│   ├── images/
│   │   ├── home/
│   │   ├── services/
│   │   ├── blog/
│   │   └── team/
│   └── fonts/
│
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx
│   │   │   ├── servicos/
│   │   │   ├── contabilidade-digital/
│   │   │   ├── solucoes/
│   │   │   ├── armel-x-tecnologia/
│   │   │   ├── planos/
│   │   │   ├── como-funciona/
│   │   │   ├── conteudos/
│   │   │   ├── blog/
│   │   │   ├── sobre/
│   │   │   ├── duvidas/
│   │   │   ├── contato/
│   │   │   └── solicitar-proposta/
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── recuperar-senha/
│   │   │
│   │   ├── portal/
│   │   │   └── README.md
│   │   │
│   │   ├── admin/
│   │   │   └── README.md
│   │   │
│   │   ├── api/
│   │   │   ├── leads/
│   │   │   ├── contact/
│   │   │   └── webhooks/
│   │   │
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── marketing/
│   │   ├── forms/
│   │   ├── sections/
│   │   ├── portal/
│   │   ├── admin/
│   │   └── shared/
│   │
│   ├── config/
│   │   ├── site.ts
│   │   ├── navigation.ts
│   │   ├── services.ts
│   │   ├── plans.ts
│   │   ├── features.ts
│   │   └── integrations.ts
│   │
│   ├── content/
│   │   ├── blog/
│   │   ├── services/
│   │   └── faq/
│   │
│   ├── design-system/
│   │   ├── tokens/
│   │   ├── components/
│   │   ├── foundations/
│   │   └── index.ts
│   │
│   ├── lib/
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── seo/
│   │   ├── security/
│   │   ├── validation/
│   │   ├── permissions/
│   │   └── utils/
│   │
│   ├── integrations/
│   │   ├── email/
│   │   ├── whatsapp/
│   │   ├── crm/
│   │   ├── automation/
│   │   ├── billing/
│   │   ├── signature/
│   │   ├── calendar/
│   │   ├── storage/
│   │   ├── accounting/
│   │   ├── analytics/
│   │   └── ai/
│   │
│   ├── actions/
│   ├── hooks/
│   ├── types/
│   ├── styles/
│   ├── emails/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
│
├── scripts/
│   ├── check-links.mjs
│   ├── generate-sitemap.mjs
│   └── audit-seo.mjs
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── README.md
│
├── .env.example
├── .gitignore
├── .editorconfig
├── .prettierignore
├── .prettierrc
├── eslint.config.js
├── next.config.ts
├── package.json
├── tsconfig.json
├── Wjb-Website.md
├── Claude.md
├── README.md
└── LICENSE
```

---

# 24. Regras de Organização das Pastas

## `src/app`

Responsável somente por:

- rotas;
- layouts;
- loading;
- error;
- pages;
- route handlers.

Não colocar lógica de negócio complexa diretamente em páginas.

## `src/components/ui`

Componentes de baixo nível:

- Button;
- Card;
- Input;
- Select;
- Dialog;
- Tabs;
- Accordion;
- Badge.

## `src/components/sections`

Seções completas de páginas:

- Hero;
- Services;
- Testimonials;
- CTA;
- FAQ.

## `src/config`

Fonte central para dados globais.

Nunca espalhar dados institucionais hardcoded.

## `src/design-system`

Código relacionado ao Design System.

## `src/lib`

Código compartilhado e regras técnicas.

## `src/integrations`

Toda integração com serviços externos.

## `docs`

Documentação humana do projeto.

---

# 25. Configuração Central

Criar:

`src/config/site.ts`

Exemplo:

```ts
export const siteConfig = {
  name: "WJB Assessoria Contábil",
  legalName: "[CONFIRMAR]",
  url: "[CONFIRMAR]",
  email: "[CONFIRMAR]",
  phone: "[CONFIRMAR]",
  whatsapp: "[CONFIRMAR]",
  cnpj: "[CONFIRMAR]",
  crc: "[CONFIRMAR]",
  address: "[CONFIRMAR]",
  armelxUrl: "[CONFIRMAR]",
};
```

---

# 26. Feature Flags

Criar:

`src/config/features.ts`

```ts
export const featureFlags = {
  clientPortal: false,
  openingTracker: false,
  plansPricing: false,
  invoiceModule: false,
  payrollModule: false,
  financialDashboard: false,
  integrationsHub: false,
  calculators: true,
  blog: true,
  armelxPartnership: true,
};
```

A V1 começa com funcionalidades SaaS desativadas.

---

# 27. Organização no VS Code

## Extensões recomendadas

`.vscode/extensions.json`

Sugestões:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens
- Error Lens
- Playwright
- EditorConfig
- GitHub Actions
- Prisma ou Supabase, se utilizado posteriormente

## Workspace

Manter:

- format on save;
- ESLint;
- organize imports;
- TypeScript strict;
- arquivos finais com newline;
- UTF-8;
- 2 espaços.

---

# 28. Organização no GitHub

## Branches

```text
main
develop
feature/*
fix/*
refactor/*
docs/*
chore/*
release/*
```

### `main`

Produção.

### `develop`

Integração da próxima versão.

### `feature/*`

Novas funcionalidades.

Exemplo:

```text
feature/home-hero
feature/mobile-navigation
feature/contact-form
```

---

# 29. Conventional Commits

Usar:

```text
feat:
fix:
docs:
style:
refactor:
test:
chore:
perf:
ci:
build:
```

Exemplos:

```text
feat: create responsive mobile navigation
fix: improve focus state on service cards
docs: update SaaS integration architecture
perf: optimize hero image loading
```

---

# 30. Pull Requests

Nenhuma feature relevante deve ser enviada diretamente para `main`.

PR deve conter:

- objetivo;
- alterações;
- screenshots;
- testes;
- acessibilidade;
- responsividade;
- impacto em SEO;
- riscos;
- checklist.

---

# 31. GitHub Actions

Criar pipelines para:

## CI

Executar:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

## E2E

Executar Playwright.

## Preview

Deploy automático em Preview para PRs.

---

# 32. Fases de Desenvolvimento

## FASE 0 — Discovery e Preparação

Objetivo:

- compreender site atual;
- mapear conteúdo;
- mapear URLs;
- confirmar dados institucionais;
- analisar Design System;
- validar benchmark;
- criar sitemap;
- definir backlog.

Entregáveis:

- inventário;
- sitemap;
- Design System mapeado;
- backlog;
- roadmap.

---

## FASE 1 — Fundação Técnica e Design System

Criar:

- projeto Next.js;
- TypeScript;
- Tailwind;
- lint;
- prettier;
- aliases;
- tokens;
- componentes base;
- grid;
- tipografia;
- acessibilidade base.

Entregáveis:

- app rodando;
- Design System implementado;
- Storybook opcional;
- documentação.

---

## FASE 2 — Navegação e Estrutura Global

Criar:

- header;
- mega menu;
- menu mobile;
- footer;
- layouts;
- breadcrumb;
- container;
- CTA padrão.

Entregáveis:

- navegação desktop;
- navegação mobile;
- acessibilidade validada.

---

## FASE 3 — Home

Construir:

- Hero;
- Trust;
- necessidades;
- serviços;
- contabilidade digital;
- humano + tecnologia;
- como funciona;
- planos;
- reforma tributária;
- Armel-x;
- depoimentos;
- conteúdo;
- FAQ;
- CTA final.

---

## FASE 4 — Páginas de Serviços

Criar todas as landing pages.

Prioridade:

1. Abrir Empresa
2. Trocar de Contador
3. Contabilidade Completa
4. Fiscal e Tributário
5. Departamento Pessoal
6. Planejamento Tributário
7. Reforma Tributária
8. Regularização
9. Consultoria
10. Recuperação Tributária

---

## FASE 5 — Conteúdo e Conversão

Criar:

- blog;
- conteúdo;
- FAQ;
- formulário de contato;
- proposta;
- abertura;
- troca de contador;
- tracking;
- WhatsApp.

---

## FASE 6 — SEO, Performance e Acessibilidade

Executar:

- SEO técnico;
- redirects;
- schemas;
- sitemap;
- performance;
- imagens;
- Lighthouse;
- WCAG;
- keyboard test;
- mobile QA.

---

## FASE 7 — QA e Lançamento da V1

Checklist:

- lint;
- typecheck;
- unit tests;
- E2E;
- build;
- links;
- 404;
- formulários;
- analytics;
- consentimento;
- responsividade;
- segurança básica;
- staging;
- produção.

---

# 33. Gate V1 → V2

A V2 só inicia quando:

- site aprovado;
- Design System aprovado;
- responsividade aprovada;
- acessibilidade aprovada;
- SEO configurado;
- formulários funcionando;
- analytics funcionando;
- redirects validados;
- build limpo;
- produção estável.

---

# 34. Fases da Plataforma SaaS

## SAAS FASE 1 — Arquitetura

- autenticação;
- banco;
- tenants;
- RBAC;
- RLS;
- Storage;
- auditoria.

## SAAS FASE 2 — Portal do Cliente

- dashboard;
- empresa;
- usuários;
- documentos;
- obrigações;
- guias.

## SAAS FASE 3 — Comunicação

- tickets;
- mensagens;
- notificações;
- calendário.

## SAAS FASE 4 — Admin WJB

- empresas;
- usuários;
- leads;
- documentos;
- obrigações;
- tickets;
- logs.

## SAAS FASE 5 — Integrações

- e-mail;
- WhatsApp;
- CRM;
- assinatura;
- automação;
- armazenamento;
- ERP;
- cobrança quando necessário.

## SAAS FASE 6 — Segurança e Piloto

- pentest;
- auditoria;
- logs;
- monitoramento;
- performance;
- QA;
- piloto controlado.

---

# 35. APIs e Integrações

Toda integração deve usar:

- API oficial;
- OAuth quando disponível;
- secret no servidor;
- scopes mínimos;
- rate limiting;
- timeout;
- retries;
- idempotência;
- webhooks assinados;
- logs;
- LGPD.

---

# 36. Providers Potenciais

## E-mail

- Resend
- Postmark
- SendGrid
- Amazon SES

## WhatsApp

- Meta WhatsApp Business Platform
- BSP oficial

## CRM

- HubSpot
- Pipedrive
- RD Station CRM

## Automação

- n8n
- Make
- Zapier

## Assinatura

- Clicksign
- ZapSign
- DocuSign
- Adobe Acrobat Sign

## Agenda

- Google Calendar
- Microsoft Graph
- Calendly

## Billing

- Stripe
- Mercado Pago
- Pagar.me
- Asaas

## Observabilidade

- Sentry
- Datadog
- OpenTelemetry

## ERP / Fiscal

Preparar adapters para sistemas como:

- Omie
- Conta Azul
- Nibo
- PlugNotas
- NFE.io

Somente implementar após confirmar API oficial, plano, credenciais e documentação.

---

# 37. Adapter Pattern

Estrutura:

```text
src/integrations/
└── email/
    ├── types.ts
    ├── provider.ts
    ├── resend.adapter.ts
    └── index.ts
```

A aplicação não deve depender diretamente de um provider.

---

# 38. Segurança

Aplicar:

- CSP;
- HSTS;
- X-Content-Type-Options;
- Referrer Policy;
- Permissions Policy;
- validação server-side;
- rate limit;
- storage privado;
- signed URLs;
- RLS;
- secrets fora do código;
- logs;
- auditoria.

---

# 39. LGPD

Implementar:

- Política de Privacidade;
- Cookies;
- consentimento;
- minimização;
- retenção;
- anonimização/exclusão quando aplicável;
- controle de acesso;
- proteção de dados.

Nunca enviar dados sensíveis para analytics.

---

# 40. Testes

## Unit

- validação;
- utilities;
- permissions.

## Integration

- forms;
- auth;
- API;
- storage.

## E2E

- navegação;
- formulário;
- login;
- portal;
- autorização.

Preferência:

- Vitest
- Playwright

---

# 41. Definition of Done

Uma tarefa só é concluída quando:

- atende o Design System;
- usa 6px quando aplicável;
- é responsiva;
- é acessível;
- não gera erro TypeScript;
- lint passa;
- testes relevantes passam;
- build passa;
- não contém dados inventados;
- documentação necessária está atualizada.

---

# 42. Dados que Precisam ser Confirmados

Antes do lançamento:

- telefone oficial;
- WhatsApp;
- e-mail;
- CNPJ;
- CRC;
- endereço;
- horários;
- anos de mercado;
- número de clientes;
- planos;
- preços;
- serviços efetivamente ofertados;
- URL oficial da Armel-x;
- links sociais.

---

# 43. Regra de Dados

Nunca inventar:

- números de clientes;
- avaliações;
- depoimentos;
- prêmios;
- certificações;
- preços;
- redução tributária;
- integrações existentes.

Usar:

```text
[CONFIRMAR]
```

---

# 44. Documentação Obrigatória

O repositório deve manter:

```text
README.md
Wjb-Website.md
Claude.md
docs/architecture/architecture.md
docs/design/design-system.md
docs/design/accessibility.md
docs/product/roadmap.md
docs/product/sitemap.md
docs/security/security.md
docs/security/lgpd.md
docs/api/integrations.md
```

---

# 45. Relação entre os Documentos

## `README.md`

Guia rápido para desenvolvedores.

## `Wjb-Website.md`

Fonte de verdade sobre produto, arquitetura e escopo.

## `Claude.md`

Instruções operacionais para o agente Claude.

## `docs/`

Documentação detalhada por domínio.

---

# 46. Ordem Oficial de Trabalho

Sempre seguir:

```text
1. Ler Claude.md
2. Ler Wjb-Website.md
3. Ler Design System
4. Verificar fase atual
5. Verificar issue/tarefa
6. Analisar arquivos envolvidos
7. Planejar
8. Implementar
9. Testar
10. Documentar
11. Gerar resumo
```

---

# 47. Resultado Esperado

O resultado final deve transformar a WJB em uma marca digital que combine:

**Pessoas + Contabilidade + Clareza + Tecnologia.**

A V1 deve ser excelente como website.

A V2 deve evoluir essa mesma base para um SaaS seguro e escalável.

Não sacrificar qualidade da V1 para antecipar funcionalidades da V2.
