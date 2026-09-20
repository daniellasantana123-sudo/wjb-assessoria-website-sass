-- Fase 5 do wjb-saas-mvp (2026-09-20) - Console Admin WJB.
--
-- Duas mudanças de schema:
--
-- 1) `tenants.status` (reaproveita o enum `account_status` já existente,
--    0016_account_status.sql - mesmo "active"/"suspended" de perfil e
--    membership, nenhum enum novo). Suspender a EMPRESA inteira é mais
--    severo que suspender um `tenant_member` (0016): bloqueia o acesso de
--    TODOS os membros, não só de uma pessoa.
--
-- 2) Achado de segurança real ao implementar a suspensão de empresa:
--    `my_tenant_ids()` (0003_fix_tenant_members_rls_recursion.sql) nunca
--    checava `tenant_members.status` nem existia checagem de
--    `tenants.status` - ou seja, mesmo depois da Fase 2 (suspensão de
--    membership), a RLS de `documents`/`obligations`/`tickets`/`messages`/
--    `notifications`/`omie_client_mappings` (todas usam
--    `tenant_id in (select my_tenant_ids())`) continuava liberando acesso
--    a um vínculo suspenso - a checagem de `status` só existia no nível de
--    aplicação (`getTenantRole()`), nunca no banco, que é o mecanismo do
--    qual este projeto diz depender de verdade (Claude.md/RLS). Corrigido
--    aqui: `my_tenant_ids()` agora filtra os dois status. Mesmo
--    `CREATE OR REPLACE FUNCTION` (assinatura igual), então nenhuma policy
--    existente precisa ser recriada.

alter table public.tenants
  add column status public.account_status not null default 'active';

comment on column public.tenants.status is
  'active: empresa opera normalmente. suspended: TODOS os membros perdem acesso (RLS via my_tenant_ids()), independente do status individual de cada tenant_member.';

create or replace function public.my_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
  from public.tenant_members tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.profile_id = auth.uid()
    and tm.status = 'active'
    and t.status = 'active';
$$;

-- `is_tenant_owner()` também não checava status - um owner suspenso (ou de
-- uma empresa suspensa) não deveria continuar convidando gente nova
-- (policy `tenant_members_insert_staff_or_owner`, 0006).
create or replace function public.is_tenant_owner(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = check_tenant_id
      and tm.profile_id = auth.uid()
      and tm.role = 'owner'
      and tm.status = 'active'
      and t.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------
-- feature_flags - kill switches operacionais (seção "Feature flags" do
-- prompt da Fase 5). Só as 3 features com um ponto de chamada real onde
-- a flag é checada de fato (ver `src/lib/feature-flags.ts`) - criar uma
-- flag que nada verifica seria um toggle decorativo, enganoso pra quem
-- usa o console.
-- ---------------------------------------------------------------------

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

comment on table public.feature_flags is
  'Kill switches operacionais, staff-legíveis e só super_admin-editáveis. Cada key precisa ter um ponto de checagem real no código - ver decisions.md da Fase 5.';

alter table public.feature_flags enable row level security;

-- Leitura liberada pra qualquer usuário autenticado (staff e cliente) -
-- páginas do Portal precisam ler o estado pra decidir o que mostrar
-- (ex.: esconder o CTA do Omie se a flag estiver desligada). Não é dado
-- sensível, só um booleano por feature.
create policy "feature_flags_select_authenticated"
  on public.feature_flags for select
  using (auth.uid() is not null);

create policy "feature_flags_write_super_admin_only"
  on public.feature_flags for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.feature_flags (key, enabled) values
  ('omie_gclick', true),
  ('documents', true),
  ('notifications', true);
