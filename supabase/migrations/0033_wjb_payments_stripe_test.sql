-- =====================================================================
-- WJB AI - Fase 9.1 (2026-11-21). SOMENTE ADITIVA.
-- Pagamentos pela Stripe em MODO DE TESTE (ou provedor simulado).
--
-- Regras gravadas no banco:
-- - assinatura só 'simulado' ou 'stripe_test'; modo live NÃO existe aqui;
-- - evento de pagamento com livemode = true é recusado por CHECK;
-- - cada evento é registrado uma vez (id do provedor como chave): webhook
--   repetido não produz efeito duas vezes;
-- - nenhum dado de cartão é guardado (só ids do provedor e valores);
-- - escrita só pelo servidor (service role); empresa lê só o que é dela;
--   ids de cliente/preço no provedor e o log de eventos só a equipe lê.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/19_rollback_0033.sql
-- Depende de: 0030, 0032.
-- =====================================================================

alter table public.commercial_subscriptions drop constraint commercial_subscriptions_mode_check;
alter table public.commercial_subscriptions add constraint commercial_subscriptions_mode_check
  check (mode in ('simulado', 'stripe_test'));
alter table public.commercial_subscriptions drop constraint commercial_subscriptions_status_check;
alter table public.commercial_subscriptions add constraint commercial_subscriptions_status_check
  check (status in ('ativa_simulada', 'pendente_pagamento', 'ativa_teste', 'inadimplente', 'suspensa', 'cancelada'));
alter table public.commercial_subscriptions
  add column provider_subscription_id text unique,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

-- Um cliente no provedor por empresa contratante.
create table public.payment_customers (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  mode text not null check (mode in ('mock', 'test')),
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

-- Preço no provedor para cada versão aprovada do plano (e variante do combo).
create table public.payment_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.commercial_plans (id),
  plan_version integer not null,
  mode text not null check (mode in ('mock', 'test')),
  discount_bp integer not null default 0 check (discount_bp between 0 and 5000),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  provider_price_id text not null unique,
  provider_product_id text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, plan_version, mode, discount_bp)
);

create table public.payment_checkouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subscription_id uuid not null references public.commercial_subscriptions (id) on delete cascade,
  plan_id uuid not null references public.commercial_plans (id),
  plan_version integer not null,
  kind text not null check (kind in ('subscription', 'setup')),
  mode text not null check (mode in ('mock', 'test')),
  provider_session_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  discount_bp integer not null default 0,
  status text not null default 'aberto' check (status in ('aberto', 'concluido', 'expirado', 'cancelado')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index payment_checkouts_tenant_idx on public.payment_checkouts (tenant_id, created_at desc);

-- Log de eventos do provedor: sem payload, sem dado pessoal. Uma linha por evento.
create table public.payment_events (
  provider_event_id text primary key,
  mode text not null check (mode in ('mock', 'test')),
  type text not null check (length(type) <= 100),
  livemode boolean not null default false check (livemode = false),
  object_id text,
  tenant_id uuid references public.tenants (id) on delete set null,
  status text not null default 'recebido' check (status in ('recebido', 'processado', 'ignorado', 'falhou')),
  attempts integer not null default 1,
  last_error text check (last_error is null or length(last_error) <= 300),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index payment_events_received_idx on public.payment_events (received_at desc);

create table public.payment_invoices (
  provider_invoice_id text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subscription_id uuid references public.commercial_subscriptions (id) on delete set null,
  mode text not null check (mode in ('mock', 'test')),
  status text not null check (status in ('rascunho', 'aberta', 'paga', 'incobravel', 'anulada')),
  currency text not null default 'brl' check (currency = 'brl'),
  amount_due_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  amount_refunded_cents integer not null default 0,
  disputed boolean not null default false,
  period_start timestamptz,
  period_end timestamptz,
  hosted_invoice_url text check (hosted_invoice_url is null or hosted_invoice_url like 'https://%' or hosted_invoice_url like '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_invoices_tenant_idx on public.payment_invoices (tenant_id, created_at desc);

-- Objetos do provedor SIMULADO (sem Stripe): só para homologação, só o servidor.
create table public.payment_mock_objects (
  id text primary key,
  type text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.payment_customers enable row level security;
alter table public.payment_prices enable row level security;
alter table public.payment_checkouts enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_invoices enable row level security;
alter table public.payment_mock_objects enable row level security;

create policy payment_customers_select_staff on public.payment_customers for select using (public.is_staff());
create policy payment_prices_select_staff on public.payment_prices for select using (public.is_staff());
create policy payment_events_select_staff on public.payment_events for select using (public.is_staff());
create policy payment_checkouts_select on public.payment_checkouts for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy payment_invoices_select on public.payment_invoices for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
-- payment_mock_objects: nenhuma política (nem equipe lê pelo navegador).

grant select on public.payment_customers, public.payment_prices, public.payment_events,
  public.payment_checkouts, public.payment_invoices to authenticated;

-- Direito de uso: assinatura simulada ativa OU paga em modo de teste.
-- Pendente, inadimplente, suspensa ou cancelada: sem direito.
create or replace function public.has_entitlement(p_tenant_id uuid, p_feature text)
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
      where s.tenant_id = p_tenant_id and s.status in ('ativa_simulada', 'ativa_teste') and p.product = 'emissao')
    when 'contabilidade' then exists (
      select 1 from public.commercial_accounts a where a.tenant_id = p_tenant_id and a.relationship = 'contabilidade')
    else false end;
$$;
-- CREATE OR REPLACE mantém os privilégios: continua só para service role (0031).
