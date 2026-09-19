-- SAAS FASE 2 — "Usuários": a lista de colegas em /portal/usuarios embute
-- `profiles(full_name, email)` pra cada membro. A policy original de
-- `profiles` só libera ver o próprio perfil (ou staff ver todos) — um
-- usuário comum via só "—" no lugar do nome dos colegas, porque o embed
-- do Supabase retorna null quando a RLS bloqueia a linha relacionada.
--
-- Fix: policy adicional (permissiva, soma com a existente via OR) —
-- também pode ver o profile de quem é colega em algum tenant em comum.
-- Nota: isso também expõe `is_wjb_staff`/`staff_role` do colega pra quem
-- consultar — aceitável pro MVP (não é dado sensível o bastante pra
-- justificar uma view separada só com as colunas públicas agora).

create policy "profiles_select_tenant_colleagues"
  on public.profiles for select
  using (
    id in (
      select tenant_members.profile_id
      from public.tenant_members
      where tenant_members.tenant_id in (select public.my_tenant_ids())
    )
  );
