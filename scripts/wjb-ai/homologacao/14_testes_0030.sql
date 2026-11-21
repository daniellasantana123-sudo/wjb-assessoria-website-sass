\set ON_ERROR_STOP on
-- Bateria da 0030: catálogo rascunho, assinatura simulada, ledger e entitlements.
create schema homolog_test;
grant usage on schema homolog_test to authenticated, service_role, anon;
create function homolog_test.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
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
-- Consulta como o servidor (o dono da função de teste tem execute; usuário logado não, desde a 0031).
create function homolog_test.entitled(p_tenant uuid, p_feature text) returns boolean language sql security definer as $$
  select public.has_entitlement(p_tenant, p_feature) $$;
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

begin;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect_error($$insert into public.commercial_plans (sku, product, name) values ('nfse_mei','emissao','MEI Digital')$$, 'T77 contador não cria plano (só super_admin)');
select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
insert into public.commercial_plans (id, sku, product, name, monthly_cents, quota, overage_cents)
values ('aa000000-0000-4000-8000-000000000001','nfse_mei','emissao','MEI Digital (rascunho)',2490,10,390);
select homolog_test.expect_error($$update public.commercial_plans set status = 'approved' where sku = 'nfse_mei'$$, 'T78 plano não pode ser aprovado nesta fase (só draft/archived)');
update public.commercial_plans set monthly_cents = 2990 where sku = 'nfse_mei';
select homolog_test.expect((select version from public.commercial_plans where sku = 'nfse_mei') = 2
  and (select count(*) from public.commercial_plan_changes where plan_id = 'aa000000-0000-4000-8000-000000000001') = 2, 'T79 alteração de preço gera versão e histórico');
select homolog_test.expect_error($$delete from public.commercial_plans where sku = 'nfse_mei'$$, 'T80 plano não pode ser apagado (arquivar)');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.commercial_plans) = 0, 'T81 cliente não lê o catálogo direto');
select homolog_test.expect_error($$insert into public.commercial_subscriptions (tenant_id, plan_id, plan_sku, cycle_start, cycle_end) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa000000-0000-4000-8000-000000000001','nfse_mei','2026-11-01','2026-12-01')$$, 'T82 cliente não cria assinatura direto (só o servidor)');
reset role;

set local role service_role;
select homolog_test.expect_error($$insert into public.commercial_subscriptions (tenant_id, plan_id, plan_sku, mode, cycle_start, cycle_end) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa000000-0000-4000-8000-000000000001','nfse_mei','real','2026-11-01','2026-12-01')$$, 'T83 assinatura real é recusada (só simulado)');
insert into public.commercial_subscriptions (id, tenant_id, plan_id, plan_sku, monthly_cents, quota, overage_cents, cycle_start, cycle_end)
values ('bb000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa000000-0000-4000-8000-000000000001','nfse_mei',2990,10,390,'2026-11-01','2026-12-01');
select homolog_test.expect_error($$insert into public.commercial_subscriptions (tenant_id, plan_id, plan_sku, cycle_start, cycle_end) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa000000-0000-4000-8000-000000000001','nfse_mei','2026-11-01','2026-12-01')$$, 'T84 segunda assinatura aberta para a mesma empresa é recusada');
select homolog_test.expect(homolog_test.entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','nfse') and not homolog_test.entitled('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','nfse'), 'T85 direito de emissão só para a empresa com assinatura');
insert into public.fiscal_requests (id, tenant_id, idempotency_key, draft_snapshot, draft_hash) values ('cc000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','uso-1','{}','h');
select homolog_test.expect_error($$insert into public.commercial_usage_ledger (tenant_id, request_id, kind, billable, cycle_start) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cc000000-0000-4000-8000-000000000001','simulada',true,'2026-11-01')$$, 'T86 consumo simulado nunca é faturável');
insert into public.commercial_usage_ledger (tenant_id, subscription_id, request_id, kind, cycle_start) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','simulada','2026-11-01');
select homolog_test.expect_error($$insert into public.commercial_usage_ledger (tenant_id, request_id, kind, cycle_start) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cc000000-0000-4000-8000-000000000001','simulada','2026-11-01')$$, 'T87 o mesmo pedido não consome duas vezes');
select homolog_test.expect_error($$update public.commercial_usage_ledger set billable = false$$, 'T88 ledger é imutável');
update public.commercial_subscriptions set status = 'suspensa' where id = 'bb000000-0000-4000-8000-000000000001';
select homolog_test.expect(not homolog_test.entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','nfse'), 'T89 assinatura suspensa perde o direito na hora');
reset role;
select homolog_test.act_as('22222222-2222-4222-8222-222222222222');
select homolog_test.expect_error($$select public.has_entitlement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','nfse')$$, 'T92 usuário logado não consulta o direito de outra empresa (0031)');
select homolog_test.expect((select count(*) from public.commercial_subscriptions) = 0 and (select count(*) from public.commercial_usage_ledger) = 0, 'T90 empresa B não vê assinatura nem consumo da A');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.commercial_subscriptions) = 1, 'T91 empresa A vê a própria assinatura');
rollback;

drop schema homolog_test cascade;
