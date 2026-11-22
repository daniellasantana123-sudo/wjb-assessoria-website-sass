\set ON_ERROR_STOP on
-- Bateria da 0032: aprovação versionada de preço e histórico de configuração.
create schema homolog_test;
grant usage on schema homolog_test to authenticated, service_role, anon;
create function homolog_test.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  -- 0035: sessão simulada com MFA concluído (aal2), como a equipe usa na aplicação.
  perform set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'aal', 'aal2')::text end, true);
  if p_user is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create function homolog_test.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    raise notice 'OK  % (bloqueado: %)', p_label, sqlstate; return; end;
  raise exception 'FALHA % - deveria ter sido bloqueado', p_label;
end $$;
create function homolog_test.expect(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not p_cond then raise exception 'FALHA %', p_label; end if;
  raise notice 'OK  %', p_label;
end $$;
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

-- Consulta de direito de uso como o servidor (usuário logado não executa desde a 0031).
create function homolog_test.entitled(p_tenant uuid) returns boolean language sql security definer as $$
  select public.has_entitlement(p_tenant, 'nfse') $$;
grant execute on function homolog_test.entitled(uuid) to authenticated, anon;

begin;
insert into public.commercial_plans (id, sku, product, name, monthly_cents, quota, overage_cents)
values ('ac000000-0000-4000-8000-000000000001','nfse_mei','emissao','MEI Digital',2490,10,390);
select homolog_test.expect_error($$insert into public.commercial_subscriptions (tenant_id, plan_id, plan_sku, mode, cycle_start, cycle_end) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ac000000-0000-4000-8000-000000000001','nfse_mei','stripe_live','2026-11-01','2026-12-01')$$, 'T104 assinatura em modo live não existe no banco');
insert into public.commercial_subscriptions (id, tenant_id, plan_id, plan_sku, mode, status, monthly_cents, quota, overage_cents, cycle_start, cycle_end)
values ('bc000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ac000000-0000-4000-8000-000000000001','nfse_mei','stripe_test','pendente_pagamento',2490,10,390,'2026-11-01','2026-12-01');
select homolog_test.expect(not homolog_test.entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T105 pagamento pendente não dá direito de uso');
select homolog_test.expect_error($$insert into public.commercial_subscriptions (tenant_id, plan_id, plan_sku, mode, cycle_start, cycle_end) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ac000000-0000-4000-8000-000000000001','nfse_mei','stripe_test','2026-11-01','2026-12-01')$$, 'T106 checkout pendente bloqueia segunda assinatura da mesma empresa');
update public.commercial_subscriptions set status = 'ativa_teste' where id = 'bc000000-0000-4000-8000-000000000001';
select homolog_test.expect(homolog_test.entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T107 pagamento confirmado (teste) dá direito de uso');
update public.commercial_subscriptions set status = 'inadimplente' where id = 'bc000000-0000-4000-8000-000000000001';
select homolog_test.expect(not homolog_test.entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T108 inadimplente perde o direito de uso');
insert into public.payment_events (provider_event_id, mode, type) values ('evt_teste_1','test','invoice.paid');
select homolog_test.expect_error($$insert into public.payment_events (provider_event_id, mode, type) values ('evt_teste_1','test','invoice.paid')$$, 'T109 o mesmo evento não é registrado duas vezes');
select homolog_test.expect_error($$insert into public.payment_events (provider_event_id, mode, type, livemode) values ('evt_live','test','invoice.paid',true)$$, 'T110 evento de produção (livemode) é recusado');
select homolog_test.expect_error($$insert into public.payment_customers (tenant_id, mode, provider_customer_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_x')$$, 'T111 cliente em modo live é recusado');
insert into public.payment_customers (tenant_id, mode, provider_customer_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','cus_teste_a');
insert into public.payment_invoices (provider_invoice_id, tenant_id, subscription_id, mode, status, amount_due_cents, amount_paid_cents)
values ('in_teste_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bc000000-0000-4000-8000-000000000001','test','paga',2490,2490);
select homolog_test.expect_error($$insert into public.payment_invoices (provider_invoice_id, tenant_id, mode, status, currency) values ('in_usd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','paga','usd')$$, 'T112 fatura só em reais');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.payment_invoices) = 1, 'T113 empresa A vê a própria fatura');
select homolog_test.expect((select count(*) from public.payment_customers) = 0 and (select count(*) from public.payment_events) = 0, 'T114 cliente não vê id de cliente no provedor nem log de eventos');
select homolog_test.expect_error($$insert into public.payment_invoices (provider_invoice_id, tenant_id, mode, status) values ('in_forjada','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','paga')$$, 'T115 cliente não grava fatura');
update public.commercial_subscriptions set status = 'ativa_teste' where id = 'bc000000-0000-4000-8000-000000000001';
reset role;
select homolog_test.expect((select status from public.commercial_subscriptions where id = 'bc000000-0000-4000-8000-000000000001') = 'inadimplente', 'T116 cliente não se reativa pelo navegador');
select homolog_test.act_as('22222222-2222-4222-8222-222222222222');
select homolog_test.expect((select count(*) from public.payment_invoices) = 0 and (select count(*) from public.payment_checkouts) = 0, 'T117 empresa B não vê fatura nem checkout da A');
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect((select count(*) from public.payment_customers) = 1 and (select count(*) from public.payment_events) = 1, 'T118 equipe lê clientes e eventos de pagamento');
select homolog_test.expect((select count(*) from public.payment_mock_objects) = 0, 'T119 objetos do provedor simulado não são lidos pelo navegador');
rollback;

drop schema homolog_test cascade;
