-- Corrige "infinite recursion detected in policy for relation
-- 'tenant_members'" (42P17), encontrado ao testar a criação de empresa de
-- ponta a ponta (2026-09-16).
--
-- Causa: a policy de SELECT de `tenant_members` fazia um self-join na
-- própria `tenant_members` dentro do seu USING — toda leitura da tabela
-- reavaliava a mesma policy recursivamente. Como `tenants_select_...`
-- também faz um EXISTS em `tenant_members`, qualquer SELECT em `tenants`
-- (inclusive o `.select()` implícito depois de um INSERT) disparava a
-- recursão.
--
-- Fix: mesmo padrão de `is_staff()` — funções SECURITY DEFINER que
-- consultam `tenant_members` ignorando RLS (rodam com o dono da função),
-- então a policy nunca reavalia a si mesma.

create function public.my_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members where profile_id = auth.uid();
$$;

create function public.is_tenant_owner(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = check_tenant_id
      and profile_id = auth.uid()
      and role = 'owner'
  );
$$;

drop policy "tenants_select_member_or_staff" on public.tenants;
create policy "tenants_select_member_or_staff"
  on public.tenants for select
  using (public.is_staff() or id in (select public.my_tenant_ids()));

drop policy "tenants_update_staff_or_owner" on public.tenants;
create policy "tenants_update_staff_or_owner"
  on public.tenants for update
  using (public.is_staff() or public.is_tenant_owner(id));

drop policy "tenant_members_select_same_tenant_or_staff" on public.tenant_members;
create policy "tenant_members_select_same_tenant_or_staff"
  on public.tenant_members for select
  using (
    public.is_staff()
    or profile_id = auth.uid()
    or tenant_id in (select public.my_tenant_ids())
  );
