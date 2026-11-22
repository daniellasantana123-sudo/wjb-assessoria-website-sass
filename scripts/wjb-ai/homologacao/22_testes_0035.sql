\set ON_ERROR_STOP on
-- Bateria da 0035: MFA exigido NO BANCO para operações sensíveis.
-- Simula credenciais comprometidas: usuário certo (super admin / contador),
-- mas sessão só com senha (aal1). Nenhuma credencial real.
create schema homolog_test;
grant usage on schema homolog_test to authenticated, service_role, anon;
create function homolog_test.act_as(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'aal', p_aal)::text end, true);
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

begin;
-- Super admin COM MFA cria o plano e a configuração (base do teste).
select homolog_test.act_as('66666666-6666-4666-8666-666666666666', 'aal2');
insert into public.commercial_plans (id, sku, product, name, monthly_cents, quota, overage_cents) values ('ad000000-0000-4000-8000-000000000001','nfse_mfa','emissao','MFA',2490,10,390);
insert into public.commercial_settings (key, value) values ('combo_discount_bp', '2000');
-- Mesma conta, sessão só com senha (senha vazada).
select homolog_test.act_as('66666666-6666-4666-8666-666666666666', 'aal1');
update public.commercial_plans set monthly_cents = 1 where id = 'ad000000-0000-4000-8000-000000000001';
select homolog_test.expect_error($$insert into public.commercial_plans (sku, product, name) values ('nfse_x','emissao','X')$$, 'T129 super admin sem MFA não cria plano pelo banco');
select homolog_test.expect_error($$insert into public.commercial_settings (key, value) values ('cost_premises', '{}')$$, 'T130 super admin sem MFA não grava configuração comercial');
update public.commercial_settings set value = '5000' where key = 'combo_discount_bp';
select homolog_test.expect_error($$select public.grant_fiscal_profile_approver('33333333-3333-4333-8333-333333333333', null, 'Concessao com senha vazada')$$, 'T131 super admin sem MFA não concede aprovador fiscal');
select homolog_test.act_as('33333333-3333-4333-8333-333333333333', 'aal1');
select homolog_test.expect_error($$select public.approve_fiscal_profile('00000000-0000-4000-8000-000000000000', 'teste')$$, 'T132 contador sem MFA não aprova perfil fiscal');
select homolog_test.expect_error($$select public.configure_dps_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','simulado','12345678000195', 7)$$, 'T133 contador sem MFA não configura série da DPS');
select homolog_test.expect_error($$insert into public.fiscal_authorization_grants (tenant_id, kind, scope, valid_until) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','procuracao','NFS-e','2027-01-01')$$, 'T134 contador sem MFA não registra autorização de emissão');
select homolog_test.expect_error($$select public.approve_fiscal_profile_impl('00000000-0000-4000-8000-000000000000', 'teste')$$, 'T135 a função original (_impl) não é chamável direto');
reset role;
select homolog_test.expect((select monthly_cents from public.commercial_plans where id = 'ad000000-0000-4000-8000-000000000001') = 2490
  and (select value::text from public.commercial_settings where key = 'combo_discount_bp') = '2000', 'T136 preço e desconto não mudaram com a sessão sem MFA');
-- Com MFA: passa da checagem de MFA (e cai nas regras de sempre).
select homolog_test.act_as('66666666-6666-4666-8666-666666666666', 'aal2');
select homolog_test.expect((select public.grant_fiscal_profile_approver('77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Concessao com MFA (teste 0035)') is not null), 'T137 super admin com MFA concede aprovador');
update public.commercial_plans set monthly_cents = 2590 where id = 'ad000000-0000-4000-8000-000000000001';
select homolog_test.expect((select monthly_cents from public.commercial_plans where id = 'ad000000-0000-4000-8000-000000000001') = 2590, 'T138 super admin com MFA altera preço');
select homolog_test.act_as('33333333-3333-4333-8333-333333333333', 'aal2');
select homolog_test.expect_error($$select public.approve_fiscal_profile('00000000-0000-4000-8000-000000000000', 'teste')$$, 'T139 com MFA, as regras de sempre continuam (perfil inexistente recusado)');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111', 'aal2');
update public.commercial_plans set monthly_cents = 1 where id = 'ad000000-0000-4000-8000-000000000001';
reset role;
select homolog_test.expect((select monthly_cents from public.commercial_plans where id = 'ad000000-0000-4000-8000-000000000001') = 2590, 'T140 cliente com MFA continua sem poder alterar preço');
rollback;

drop schema homolog_test cascade;
