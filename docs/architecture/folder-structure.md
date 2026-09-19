# Estrutura de Pastas

> Status: **FASE 7 concluída** (o que dá para automatizar). Estrutura de pastas essencialmente completa para a V1.

A estrutura oficial do repositório está definida na seção 23 de [`../../Wjb-Website.md`](../../Wjb-Website.md), incluindo:

- `.github/` (issue templates, PR template, workflows)
- `.vscode/` (extensões, settings, launch)
- `docs/` (este diretório)
- `public/` (brand, images, fonts)
- `src/` (app, components, config, content, design-system, lib, integrations, actions, hooks, types, styles, emails, tests)
- `scripts/`
- `supabase/` (apenas na V2)

Regras de organização por pasta: seção 24 do documento mestre.

## Estado atual (2026-08-30)

Já criados: `src/app` — todas as rotas do sitemap (seção 13) existem: `/`, `/servicos` (+ `[slug]` dinâmico), `/blog` (+ `[slug]` dinâmico), `/conteudos`, `/contato`, `/solicitar-proposta`, `/area-do-cliente`, `/login`, `/sobre`, `/planos`, `/como-funciona`, `/contabilidade-digital`, `/solucoes`, `/armel-x-tecnologia`, `/duvidas`, `/politica-de-privacidade`, `/termos`, `/cookies`, `/api/leads`, `not-found.tsx`, `sitemap.ts`, `robots.ts`.

`src/components/ui` (Button, Badge, Label, Input, Textarea, Select), `src/components/layout` (Container, SkipLink, SiteFooter), `src/components/navigation` (Logo, SiteHeader, MobileNav, MegaMenu, NavDropdown, Breadcrumb), `src/hooks` (`use-disclosure.ts`), `src/components/sections` (as 12 seções da Home), `src/components/shared` (PostCard, WhatsAppButton, JsonLd, LegalPlaceholder, CookieConsentBanner, RevealOnScroll), `src/components/forms` (LeadForm, NewsletterForm), `src/config` (inclui `service-pages.ts`), `src/content/faq`, `src/content/blog`, `src/integrations/whatsapp`, `src/lib` (`validation/lead.ts`, `analytics/tracking.ts`, `analytics/loader.tsx`, `seo/schema.ts`, `seo/site-url.ts`, `consent/cookie-consent.ts`, `security/rate-limit.ts`), `src/tests/{unit,integration,e2e}`, `.vscode/` (extensions, settings, launch), `.env.example`, `.github/workflows/{ci,e2e}.yml`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `vitest.config.mts`, `playwright.config.ts`.

Ainda não criados (adicionar apenas quando a fase/necessidade real aparecer): `src/content/services`, `src/design-system` (tokens ainda vivem em `globals.css`, não foram extraídos para cá), `src/actions`, `src/types`, `src/emails`, `scripts/`, `supabase/` (só na V2).

## Pendências

- [ ] Nenhuma pendência estrutural conhecida para a V1. `.github/workflows` já configurado (CI + E2E).
