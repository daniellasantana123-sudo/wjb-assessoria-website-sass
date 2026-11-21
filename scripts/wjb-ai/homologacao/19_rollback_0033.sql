-- Rollback da 0033 (homologação). Assinaturas de teste/pagamento viram canceladas.
create or replace function public.has_entitlement(p_tenant_id uuid, p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_feature
    when 'nfse' then exists (
      select 1 from public.commercial_subscriptions s
      join public.commercial_plans p on p.id = s.plan_id
      where s.tenant_id = p_tenant_id and s.status = 'ativa_simulada' and p.product = 'emissao')
    when 'contabilidade' then exists (
      select 1 from public.commercial_accounts a where a.tenant_id = p_tenant_id and a.relationship = 'contabilidade')
    else false end;
$$;
drop table if exists public.payment_mock_objects;
drop table if exists public.payment_invoices;
drop table if exists public.payment_events;
drop table if exists public.payment_checkouts;
drop table if exists public.payment_prices;
drop table if exists public.payment_customers;
update public.commercial_subscriptions set status = 'cancelada', canceled_at = coalesce(canceled_at, now())
  where status in ('pendente_pagamento', 'ativa_teste', 'inadimplente');
update public.commercial_subscriptions set mode = 'simulado' where mode = 'stripe_test';
alter table public.commercial_subscriptions
  drop column if exists provider_subscription_id, drop column if exists current_period_end, drop column if exists cancel_at_period_end;
alter table public.commercial_subscriptions drop constraint commercial_subscriptions_status_check;
alter table public.commercial_subscriptions add constraint commercial_subscriptions_status_check
  check (status in ('ativa_simulada', 'suspensa', 'cancelada'));
alter table public.commercial_subscriptions drop constraint commercial_subscriptions_mode_check;
alter table public.commercial_subscriptions add constraint commercial_subscriptions_mode_check check (mode = 'simulado');
