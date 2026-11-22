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

begin;
select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
select homolog_test.expect_error($$insert into public.commercial_plans (sku, product, name, status, approval_reference, effective_from, approved_at) values ('nfse_x','emissao','X','approved','ref aprovação', current_date, now())$$, 'T93 plano não nasce aprovado');
insert into public.commercial_plans (id, sku, product, name, monthly_cents, quota, overage_cents)
values ('ab000000-0000-4000-8000-000000000001','nfse_mei','emissao','MEI Digital',2490,10,390);
select homolog_test.expect_error($$update public.commercial_plans set status = 'approved' where sku = 'nfse_mei'$$, 'T94 aprovação sem referência é recusada');
update public.commercial_plans set status = 'approved', approval_reference = 'Aprovação do responsável pela WJB em 21/11/2026', effective_from = '2026-11-21' where sku = 'nfse_mei';
select homolog_test.expect((select status = 'approved' and approved_by = '66666666-6666-4666-8666-666666666666' and approved_at is not null and effective_from = '2026-11-21' from public.commercial_plans where sku = 'nfse_mei'), 'T95 super admin aprova; autor e data gravados pelo banco');
update public.commercial_plans set approved_by = '33333333-3333-4333-8333-333333333333', approval_reference = 'troca indevida' where sku = 'nfse_mei';
select homolog_test.expect((select approved_by = '66666666-6666-4666-8666-666666666666' and approval_reference like 'Aprovação%' from public.commercial_plans where sku = 'nfse_mei'), 'T96 dados da aprovação não podem ser trocados depois');
update public.commercial_plans set monthly_cents = 2990 where sku = 'nfse_mei';
select homolog_test.expect((select status = 'draft' and approved_at is null from public.commercial_plans where sku = 'nfse_mei'), 'T97 mudar o preço de plano aprovado o devolve a rascunho');
select homolog_test.expect((select count(*) from public.commercial_plan_changes where plan_id = 'ab000000-0000-4000-8000-000000000001' and after->>'status' = 'approved' and after->>'effective_from' = '2026-11-21') >= 1, 'T98 histórico guarda a versão aprovada com a vigência');
insert into public.commercial_settings (key, value) values ('combo_discount_bp', '2000');
update public.commercial_settings set value = '1500' where key = 'combo_discount_bp';
select homolog_test.expect((select count(*) from public.commercial_setting_changes where key = 'combo_discount_bp') = 2, 'T99 mudança do desconto do combo entra no histórico');
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
update public.commercial_plans set status = 'approved', approval_reference = 'contador tentando aprovar', effective_from = current_date where sku = 'nfse_mei';
select homolog_test.expect((select status = 'draft' from public.commercial_plans where sku = 'nfse_mei'), 'T100 contador não aprova preço (só super admin)');
select homolog_test.expect((select count(*) from public.commercial_setting_changes) = 2, 'T101 equipe lê o histórico de configuração');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.commercial_setting_changes) = 0, 'T102 cliente não lê o histórico de configuração');
select homolog_test.expect_error($$insert into public.commercial_setting_changes (key, after) values ('x', '1')$$, 'T103 ninguém grava o histórico direto');
rollback;

drop schema homolog_test cascade;
