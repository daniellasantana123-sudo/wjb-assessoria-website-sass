\set ON_ERROR_STOP on
-- Bateria da 0028: trilha de uso do certificado, imutável.
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
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

begin;
set local role service_role;
insert into public.fiscal_certificate_usage (tenant_id, purpose, environment, outcome, certificate_fingerprint, reason)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'assinatura', 'simulado', 'ok', repeat('b', 64), null),
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'mtls', 'simulado', 'negado', null, 'GRANT_REVOKED');
select homolog_test.expect((select count(*) from public.fiscal_certificate_usage) = 2, 'T63 servidor registra o uso do certificado');
select homolog_test.expect_error($$update public.fiscal_certificate_usage set outcome = 'ok'$$, 'T64 nem o servidor altera a trilha');
select homolog_test.expect_error($$delete from public.fiscal_certificate_usage$$, 'T65 nem o servidor apaga a trilha');
select homolog_test.expect_error($$insert into public.fiscal_certificate_usage (tenant_id, purpose, environment, outcome, reason) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','assinatura','simulado','erro','senha do pfx: 123')$$, 'T66 motivo não aceita senha');
reset role;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect((select count(*) from public.fiscal_certificate_usage) = 2, 'T67 equipe lê a trilha');
select homolog_test.expect_error($$insert into public.fiscal_certificate_usage (tenant_id, purpose, environment, outcome) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','assinatura','simulado','ok')$$, 'T68 equipe não grava na trilha (só o servidor)');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.fiscal_certificate_usage) = 0, 'T69 cliente não vê a trilha');
reset role;
insert into public.tenants (id, name, cnpj) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Empresa Ficticia C','00.000.000/0003-53');
insert into public.fiscal_certificate_usage (tenant_id, purpose, environment, outcome) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','assinatura','simulado','ok');
delete from public.tenants where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select homolog_test.expect((select count(*) from public.fiscal_certificate_usage where tenant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') = 0
  and (select count(*) from public.fiscal_certificate_usage) = 2, 'T70 apagar a empresa remove só a trilha dela em cascata (única exceção)');
rollback;

drop schema homolog_test cascade;
