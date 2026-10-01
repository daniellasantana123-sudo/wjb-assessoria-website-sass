# WJB Assessoria Contábil - site e plataforma

Site institucional da **WJB Assessoria Contábil** e plataforma para clientes e equipe:

- **Site** ([wjbassessoriacontabil.com.br](https://wjbassessoriacontabil.com.br)): serviços, planos, blog, contato e assistente virtual.
- **Portal do Cliente** (`/portal`): obrigações, documentos, guias, relatórios, mensagens e chamados de cada empresa.
- **Admin WJB** (`/admin`): empresas, equipe, leads, chamados, logs e integração com o Omie.G-Click.

Versão atual: **1.3.0**. O histórico está em [`CHANGELOG.md`](./CHANGELOG.md).

Desenvolvido por [Armel-x Tecnologia](https://armelx.com/).

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript** e **Tailwind CSS 4**
- **Supabase**: banco Postgres com RLS, autenticação e armazenamento de arquivos
- **Resend**: e-mails de convite, recuperação de senha e avisos de novos contatos
- **Omie.G-Click**: obrigações, tarefas e cadastro de clientes do escritório
- **Vitest** (testes unitários e de integração) e **Playwright** (testes no navegador)

## Rodar localmente

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env.local   # preencha os valores necessários
npm run dev                  # http://localhost:3000
```

O site funciona sem nenhuma variável preenchida. O Portal e o Admin precisam do Supabase configurado (ver [`supabase/README.md`](./supabase/README.md)) e de `SAAS_PUBLIC_ENABLED=true`. Sem credenciais do G-Click, a integração roda em **modo simulado**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda o TypeScript |
| `npm run test` | Testes unitários e de integração (Vitest) |
| `npm run test:e2e` | Testes no navegador (Playwright, Chrome instalado na máquina) |
| `npm run format` | Formata o código com Prettier |

Para os testes de navegador da plataforma, gere o build com a plataforma ligada: `SAAS_PUBLIC_ENABLED=true npm run build`.

## Configuração

Todas as variáveis estão documentadas em [`.env.example`](./.env.example). Os grupos principais:

- **Site:** `NEXT_PUBLIC_SITE_URL`
- **Supabase:** URL, chave pública e chave de serviço
- **Plataforma:** `SAAS_PUBLIC_ENABLED` (liga o Portal e o Admin)
- **E-mail:** `RESEND_API_KEY` e `EMAIL_FROM`
- **G-Click:** `GCLICK_*` (modo, credenciais e ids da conta)
- **Lembrete diário:** `CRON_SECRET`

**Atenção, específico desta hospedagem:** variáveis do painel só existem enquanto o servidor roda, e não durante o build. Por isso o código lê as variáveis do servidor em tempo de execução, e não por `process.env.NEXT_PUBLIC_*` literal. Detalhes em [`Claude.md`](./Claude.md).

## Publicação

- **Hospedagem: Hostinger.** Cada `git push` na branch `main` gera o build e publica sozinho.
- **DNS:** fica na Hostinger.
- **Domínio:** registrado pela UOL Host.
- **Lembrete diário de obrigações:** roda pelo GitHub Actions ([`.github/workflows/lembretes-obrigacoes.yml`](./.github/workflows/lembretes-obrigacoes.yml)).

## Estrutura

```
src/
  app/            rotas: (site) site institucional, portal/, admin/, api/, auth/
  actions/        Server Actions (empresas, documentos, obrigações, G-Click...)
  components/     componentes por área
  config/         conteúdo e configuração (serviços, planos, navegação, imagens)
  content/        blog e guias
  integrations/   adaptadores externos (G-Click, e-mail, WhatsApp)
  lib/            regras, autenticação, permissões, banco
  tests/          unit/, integration/ e e2e/
supabase/         migrations do banco (aplicar em ordem)
docs/             documentação do projeto e manual da plataforma
scripts/          utilitários (manual, imagens)
```

## Documentação

- [`Wjb-Website.md`](./Wjb-Website.md): documento mestre (visão, escopo e regras do projeto)
- [`Claude.md`](./Claude.md): instruções operacionais e histórico de decisões
- [`docs/`](./docs): arquitetura, design, produto, segurança e integrações
- [`docs/integrations/gclick/`](./docs/integrations/gclick): integração com o Omie.G-Click
- **Manual da plataforma**:
  - para a equipe em `/admin/manual`;
  - para clientes em `/ajuda`;
  - fonte em [`docs/manual/`](./docs/manual), gerada com `node scripts/build-manual.mjs`.

## Versões

As versões seguem o formato `maior.menor.correção`. Para lançar uma versão:

1. atualize `version` no `package.json`;
2. registre as mudanças no [`CHANGELOG.md`](./CHANGELOG.md);
3. crie a etiqueta no Git (`git tag v1.4.0` e `git push origin v1.4.0`).

A versão em uso aparece no rodapé da barra lateral do Portal e do Admin.
