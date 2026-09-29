-- 2026-09-29 — fecha escalonamento de privilégio em public.profiles.
--
-- `profiles_update_own` (0001) é row-level: deixa cada pessoa atualizar
-- QUALQUER coluna do próprio perfil, inclusive is_wjb_staff/staff_role/status.
-- Um cliente autenticado que chamasse o PostgREST direto conseguiria se
-- promover a super_admin (ou se reativar depois de suspenso). RLS não tem
-- granularidade por coluna, então a barreira fica num trigger.
--
-- Regra: só super_admin muda campos de acesso. Chamadas sem usuário no JWT
-- (service role, SQL Editor, GoTrue) passam - auth.uid() é null nelas, e são
-- justamente os caminhos administrativos (convite, scripts de manutenção).
-- O próprio usuário continua podendo mudar full_name (tela de primeiro acesso).

create function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_super_admin()
     and (
       new.is_wjb_staff is distinct from old.is_wjb_staff
       or new.staff_role is distinct from old.staff_role
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.id is distinct from old.id
     )
  then
    raise exception 'Sem permissão para alterar campos de acesso do perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_columns();
