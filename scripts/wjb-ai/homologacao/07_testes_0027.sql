\set ON_ERROR_STOP on
-- Bateria da 0027: série/numeração da DPS e autorização de emissão.
-- A parte de concorrência roda no run.sh (vários psql em paralelo) entre
-- os blocos "preparo" e "verificação" deste arquivo.

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

-- Preparo (dados fictícios): 20 pedidos autorizados na empresa A, 1 recém-recebido.
insert into public.fiscal_requests (id, tenant_id, idempotency_key, draft_snapshot, draft_hash, status)
select ('c0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'conc-' || i, '{"v":1}', 'h' || i, 'AUTORIZADA_PARA_ENVIO'
from generate_series(1, 20) i;
insert into public.fiscal_requests (id, tenant_id, idempotency_key, draft_snapshot, draft_hash)
values ('c1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','recebido-1','{"v":1}','hr');
insert into public.fiscal_profile_approver_grants (profile_id, tenant_id, reason, granted_by)
values ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Homologação fictícia da 0027','66666666-6666-4666-8666-666666666666');

-- ---------------- Configuração da série ----------------
begin;
select homolog_test.act_as('55555555-5555-4555-8555-555555555555');
select homolog_test.expect_error($$select public.configure_dps_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','simulado','00000000000191',1)$$, 'T40 atendimento não configura série');
select homolog_test.act_as('44444444-4444-4444-8444-444444444444');
select homolog_test.expect_error($$select public.configure_dps_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','simulado','00000000000191',1)$$, 'T41 contador sem fiscal_profile.approve não configura série');
select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
select homolog_test.expect_error($$select public.configure_dps_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','producao','00000000000191',1)$$, 'T42 ambiente de produção bloqueado até para super_admin');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect_error($$insert into public.fiscal_dps_series (tenant_id, environment, emitter_document, series) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','simulado','00000000000191',9)$$, 'T43 cliente não grava série direto na tabela');
select homolog_test.expect_error($$select * from public.allocate_dps_number('c0000000-0000-4000-8000-000000000001','simulado')$$, 'T44 usuário logado não executa a numeração (só o servidor)');
rollback;

begin;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select public.configure_dps_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','simulado','00000000000191',1);
select homolog_test.expect((select count(*) from public.audit_log where action = 'fiscal.dps_series_configured') = 1, 'T45 contador autorizado configura a série e fica auditado');
commit;

begin;
set local role service_role;
select homolog_test.expect_error($$select * from public.allocate_dps_number('c1000000-0000-4000-8000-000000000001','simulado')$$, 'T46 pedido ainda não autorizado não recebe número');
select homolog_test.expect_error($$select * from public.allocate_dps_number('c0000000-0000-4000-8000-000000000001','producao_restrita')$$, 'T47 ambiente sem série configurada é recusado');
rollback;
