-- SAAS FASE 1 — Arquitetura (seção 34 do documento mestre).
-- Modelo de multitenancy: cada empresa cliente da WJB é um "tenant".
-- A equipe da WJB (profiles.is_wjb_staff = true) não pertence a nenhum
-- tenant — enxerga todos via RLS, papel definido em profiles.staff_role.
--
-- Convenção: toda tabela nova do produto entra numa migration própria
-- (0002_..., 0003_...), nunca editando esta depois de aplicada em produção.

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------

create type public.tenant_member_role as enum ('owner', 'member');

create type public.staff_role as enum ('super_admin', 'contador', 'atendimento');

-- ---------------------------------------------------------------------
-- profiles — 1:1 com auth.users. Guarda o que a autenticação do Supabase
-- não guarda (nome, se é staff da WJB e qual papel).
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  is_wjb_staff boolean not null default false,
  staff_role public.staff_role,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados de perfil por usuário autenticado — 1:1 com auth.users.';
comment on column public.profiles.is_wjb_staff is 'true = time interno WJB (Admin WJB, SAAS FASE 4); false = usuário de uma empresa cliente (Portal do Cliente, SAAS FASE 2).';

-- Cria o profile automaticamente quando um usuário se cadastra no Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Função auxiliar para as policies de RLS abaixo. SECURITY DEFINER pra não
-- cair em recursão infinita ao checar `profiles` a partir de uma policy
-- da própria tabela `profiles`.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_wjb_staff = true
  );
$$;

-- ---------------------------------------------------------------------
-- tenants — as empresas clientes da WJB dentro da plataforma.
-- ---------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.tenants is 'Empresas clientes da WJB (multitenancy) — criadas pelo time WJB no onboarding, SAAS FASE 4.';

-- ---------------------------------------------------------------------
-- tenant_members — vínculo usuário <-> empresa cliente, com papel.
-- ---------------------------------------------------------------------

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.tenant_member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (tenant_id, profile_id)
);

comment on table public.tenant_members is 'Quem tem acesso a qual empresa no Portal do Cliente, e com qual papel (owner/member).';

-- ---------------------------------------------------------------------
-- audit_log — auditoria (seção 34/38). Toda ação sensível registra aqui.
-- ---------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  tenant_id uuid references public.tenants (id),
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Log de auditoria — quem fez o quê, quando, em qual empresa. Nunca editar/apagar linhas via RLS de usuário.';

create index audit_log_tenant_id_idx on public.audit_log (tenant_id);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.audit_log enable row level security;

-- profiles: cada usuário vê e edita o próprio perfil; staff vê todos.
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- tenants: membros veem sua própria empresa; staff vê e gerencia todas.
create policy "tenants_select_member_or_staff"
  on public.tenants for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = tenants.id
        and tenant_members.profile_id = auth.uid()
    )
  );

create policy "tenants_insert_staff_only"
  on public.tenants for insert
  with check (public.is_staff());

create policy "tenants_update_staff_or_owner"
  on public.tenants for update
  using (
    public.is_staff()
    or exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = tenants.id
        and tenant_members.profile_id = auth.uid()
        and tenant_members.role = 'owner'
    )
  );

create policy "tenants_delete_staff_only"
  on public.tenants for delete
  using (public.is_staff());

-- tenant_members: um membro vê os colegas da própria empresa; staff vê tudo.
-- Inserir/editar/remover vínculo é ação de staff (onboarding, SAAS FASE 4)
-- até o Portal do Cliente ganhar convite de usuário (SAAS FASE 2).
create policy "tenant_members_select_same_tenant_or_staff"
  on public.tenant_members for select
  using (
    public.is_staff()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.tenant_members as my
      where my.tenant_id = tenant_members.tenant_id
        and my.profile_id = auth.uid()
    )
  );

create policy "tenant_members_write_staff_only"
  on public.tenant_members for all
  using (public.is_staff())
  with check (public.is_staff());

-- audit_log: qualquer usuário autenticado registra a própria ação; só
-- staff lê o log.
create policy "audit_log_insert_own_action"
  on public.audit_log for insert
  with check (actor_id = auth.uid());

create policy "audit_log_select_staff_only"
  on public.audit_log for select
  using (public.is_staff());
