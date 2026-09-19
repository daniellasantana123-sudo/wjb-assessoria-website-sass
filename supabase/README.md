# Supabase — Plataforma SaaS (V2)

Este projeto usa [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage + RLS) como
backend da Plataforma SaaS, conforme a seção 22 de `Wjb-Website.md`.

## Como aplicar as migrations num projeto novo

1. Criar um projeto em [supabase.com](https://supabase.com).
2. Copiar `Project URL`, `anon public key` e `service_role key` (Project Settings > API) para
   `.env.local` (ver `.env.example` na raiz do repo).
3. Aplicar as migrations, em ordem, pelo SQL Editor do painel do Supabase — ou via CLI:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
4. Regenerar os tipos TypeScript (substitui `src/types/database.ts`, mantido à mão até aqui):
   ```bash
   npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
   ```

## Migrations

- `0001_core_schema.sql` — SAAS FASE 1 (arquitetura): `profiles`, `tenants`, `tenant_members`,
  `audit_log`, RLS de todas as tabelas, trigger que cria `profile` automaticamente no cadastro.

Cada fase nova do SaaS (ver `docs/product/roadmap.md`) que precisar de tabela nova entra numa
migration própria (`0002_...`, `0003_...`) — nunca editar uma migration já aplicada em produção.

## Contas de usuário

Não há autocadastro público. Contas (equipe WJB e usuários das empresas clientes) são
provisionadas pelo time WJB (Admin WJB, SAAS FASE 4) via `supabase.auth.admin.createUser()`
(client `src/lib/db/supabase/admin.ts`, service role) — o usuário recebe um convite por e-mail e
define a própria senha no primeiro acesso.
