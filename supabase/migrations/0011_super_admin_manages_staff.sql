-- SAAS FASE 4 — "Usuários" (staff): só super_admin pode conceder/alterar
-- acesso interno (is_wjb_staff/staff_role) de outra pessoa — ação sensível,
-- mais restrita que "qualquer staff" (is_staff()). Policy adicional
-- (permissiva, soma com `profiles_update_own` via OR): super_admin também
-- pode atualizar QUALQUER profile, não só o próprio.

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_wjb_staff = true and staff_role = 'super_admin'
  );
$$;

create policy "profiles_update_super_admin"
  on public.profiles for update
  using (public.is_super_admin())
  with check (public.is_super_admin());
