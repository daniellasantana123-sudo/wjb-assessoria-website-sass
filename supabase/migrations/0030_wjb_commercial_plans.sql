-- =====================================================================
-- WJB AI - Fase 8 (2026-11-21). SOMENTE ADITIVA.
-- Comercialização simulada: catálogo de planos em RASCUNHO, relação comercial
-- da empresa, assinaturas SIMULADAS, aceites e ledger de consumo.
--
-- Regras gravadas no banco (não só na tela):
-- - plano só existe como 'draft' ou 'archived' nesta fase (preço não aprovado);
-- - assinatura só existe em modo 'simulado' (nenhuma cobrança real);
-- - consumo 'simulada' NUNCA é faturável; um consumo por pedido e tipo;
-- - ledger, aceites e histórico de preço são append-only;
-- - escrita de assinatura/aceite/consumo só pelo servidor (service role);
--   catálogo e configurações só por super_admin.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/13_rollback_0030.sql
-- Depende de: 0001 (tenants, profiles), 0011/0021 (is_super_admin, is_staff),
--   0018 (my_tenant_ids), 0024 (fiscal_requests).
-- =====================================================================

create table public.commercial_plans (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[a-z0-9_]{3,40}$'),
  product text not null check (product in ('emissao', 'contabilidade')),
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '',
  monthly_cents integer check (monthly_cents is null or monthly_cents >= 0),   -- null = sob proposta
  quota integer check (quota is null or quota >= 0),                          -- null = sem franquia
  overage_cents integer check (overage_cents is null or overage_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'archived')),
  version integer not null default 1,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.commercial_plan_changes (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.commercial_plans (id) on delete cascade,
  changed_by uuid references public.profiles (id),
  before jsonb,
  after jsonb not null,
  changed_at timestamptz not null default now()
);

create table public.commercial_settings (
  key text primary key check (key ~ '^[a-z_]{3,60}$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Relação comercial: cliente de contabilidade (Produto A, pode somar emissão = combo)
-- ou somente emissão (Produto B/C). Uma linha por empresa: nunca conta duplicada.
create table public.commercial_accounts (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  relationship text not null check (relationship in ('contabilidade', 'somente_emissao')),
  created_at timestamptz not null default now()
);

create table public.commercial_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id uuid not null references public.commercial_plans (id),
  mode text not null default 'simulado' check (mode = 'simulado'),
  -- Retrato do plano no momento da contratação (mudança de preço não altera contrato vigente).
  plan_sku text not null,
  monthly_cents integer,
  quota integer,
  overage_cents integer,
  discount_bp integer not null default 0 check (discount_bp between 0 and 10000),
  status text not null default 'ativa_simulada' check (status in ('ativa_simulada', 'suspensa', 'cancelada')),
  cycle_start date not null,
  cycle_end date not null,
  overage_authorized boolean not null default false,
  spending_limit_cents integer check (spending_limit_cents is null or spending_limit_cents >= 0),
  pending_plan_id uuid references public.commercial_plans (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  cancel_reason text,
  check (cycle_end > cycle_start)
);
-- No máximo uma assinatura de emissão não cancelada por empresa.
create unique index commercial_subscriptions_one_open
  on public.commercial_subscriptions (tenant_id) where status <> 'cancelada';

create table public.commercial_acceptances (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subscription_id uuid references public.commercial_subscriptions (id) on delete set null,
  user_id uuid references public.profiles (id),
  document text not null check (document in ('termos_emissao', 'privacidade', 'precos_franquia', 'representacao_fiscal')),
  document_version text not null,
  accepted_at timestamptz not null default now()
);

create table public.commercial_usage_ledger (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subscription_id uuid references public.commercial_subscriptions (id) on delete set null,
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  kind text not null check (kind in ('simulada', 'oficial_autorizada')),
  billable boolean not null default false,
  cycle_start date not null,
  created_at timestamptz not null default now(),
  -- Simulação nunca vira cobrança.
  check (kind <> 'simulada' or billable = false),
  -- Reenvio, retry ou evento duplicado não gera segundo consumo.
  unique (request_id, kind)
);
create index commercial_usage_tenant_cycle_idx on public.commercial_usage_ledger (tenant_id, cycle_start);

-- Append-only: histórico de preço, aceites e ledger.
create function public.commercial_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.tenants where id = old.tenant_id) then
    return old; -- cascata ao apagar a empresa
  end if;
  raise exception 'Registro comercial imutável.' using errcode = '42501';
end;
$$;
create trigger commercial_acceptances_append_only before update or delete on public.commercial_acceptances
  for each row execute function public.commercial_append_only();
create trigger commercial_usage_append_only before update or delete on public.commercial_usage_ledger
  for each row execute function public.commercial_append_only();

create function public.commercial_plan_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger commercial_plans_version before insert or update on public.commercial_plans
  for each row execute function public.commercial_plan_version();

-- Histórico gravado DEPOIS da linha existir (num BEFORE a FK do histórico falharia).
create function public.commercial_plan_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.commercial_plan_changes (plan_id, changed_by, before, after)
  values (new.id, auth.uid(), case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return null;
end;
$$;
create trigger commercial_plans_history after insert or update on public.commercial_plans
  for each row execute function public.commercial_plan_history();

-- Direito de uso (entitlement): calculado no banco, nunca pelo navegador.
create function public.has_entitlement(p_tenant_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_feature
    when 'nfse' then exists (
      select 1 from public.commercial_subscriptions s
      join public.commercial_plans p on p.id = s.plan_id
      where s.tenant_id = p_tenant_id and s.status = 'ativa_simulada' and p.product = 'emissao')
    when 'contabilidade' then exists (
      select 1 from public.commercial_accounts a where a.tenant_id = p_tenant_id and a.relationship = 'contabilidade')
    else false end;
$$;

alter table public.commercial_plans enable row level security;
alter table public.commercial_plan_changes enable row level security;
alter table public.commercial_settings enable row level security;
alter table public.commercial_accounts enable row level security;
alter table public.commercial_subscriptions enable row level security;
alter table public.commercial_acceptances enable row level security;
alter table public.commercial_usage_ledger enable row level security;

-- Catálogo e configurações: equipe lê; só super_admin escreve. Cliente não lê
-- direto (vê os planos pela tela, renderizada no servidor, marcada como rascunho).
create policy commercial_plans_select_staff on public.commercial_plans for select using (public.is_staff());
create policy commercial_plans_write_admin on public.commercial_plans for insert with check (public.is_super_admin());
create policy commercial_plans_update_admin on public.commercial_plans for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy commercial_plan_changes_select_staff on public.commercial_plan_changes for select using (public.is_staff());
create policy commercial_settings_select_staff on public.commercial_settings for select using (public.is_staff());
create policy commercial_settings_write_admin on public.commercial_settings for insert with check (public.is_super_admin());
create policy commercial_settings_update_admin on public.commercial_settings for update using (public.is_super_admin()) with check (public.is_super_admin());

-- Dados da empresa: equipe ou membro ativo lê; escrita só pelo servidor.
create policy commercial_accounts_select on public.commercial_accounts for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy commercial_subscriptions_select on public.commercial_subscriptions for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy commercial_acceptances_select on public.commercial_acceptances for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy commercial_usage_select on public.commercial_usage_ledger for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

grant select, insert, update on public.commercial_plans, public.commercial_settings to authenticated;
grant select on public.commercial_plan_changes, public.commercial_accounts, public.commercial_subscriptions,
  public.commercial_acceptances, public.commercial_usage_ledger to authenticated;
revoke delete on public.commercial_plans, public.commercial_settings from authenticated, anon;
revoke all on function public.has_entitlement(uuid, text) from public, anon;
grant execute on function public.has_entitlement(uuid, text) to authenticated, service_role;
