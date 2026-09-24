-- Suspensão de conta de equipe passa a valer também no banco (2026-09-24).
--
-- Achado de segurança real, do mesmo tipo que a 0018 corrigiu para
-- `my_tenant_ids()`/`is_tenant_owner()`: `is_staff()` (0001) e
-- `is_super_admin()` (0011) checam apenas `is_wjb_staff`/`staff_role` e
-- **nunca olham `profiles.status`**.
--
-- Consequência: suspender alguém da equipe (Admin > Usuários) bloqueia o
-- site - `getSession()` trata como deslogado - mas **não bloqueia a API do
-- Supabase**. Uma pessoa suspensa com um token ainda válido continuava
-- podendo ler e escrever em documentos, obrigações, tickets, mensagens e
-- empresas, porque a RLS dessas tabelas depende destas duas funções. A
-- checagem existia só na aplicação, nunca no banco - que é o mecanismo do
-- qual este projeto diz depender de verdade.
--
-- `CREATE OR REPLACE` com a mesma assinatura: nenhuma policy precisa ser
-- recriada, mesmo caminho já usado pela 0018.
--
-- Reversão (caso necessário): reexecutar as duas funções sem a linha
-- `and status = 'active'`.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_wjb_staff = true
      and status = 'active'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_wjb_staff = true
      and staff_role = 'super_admin'
      and status = 'active'
  );
$$;

comment on function public.is_staff() is
  'Equipe da WJB com conta ATIVA. O status entrou na 0021: sem ele, suspender uma conta bloqueava o site mas não a API.';
comment on function public.is_super_admin() is
  'super_admin da WJB com conta ATIVA. Mesma correção da 0021.';
