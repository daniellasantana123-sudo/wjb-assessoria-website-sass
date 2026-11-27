\set ON_ERROR_STOP on
-- Bateria da 0038: uma única origem de cobrança ativa por empresa e serviço.
-- (Fase 10F)
create schema homolog_test;
grant usage on schema homolog_test to authenticated, service_role, anon;
create function homolog_test.act_as(p_user uuid, p_aal text default 'aal2') returns void language plpgsql as $$
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
set local role service_role;
insert into public.billing_source_assignments (id, tenant_id, service_key, source, external_reference)
  values ('f0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'honorarios_contabeis', 'omie', 'ref-omie-ficticia');
select homolog_test.expect_error($$insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'honorarios_contabeis', 'stripe')$$, 'T260 segunda origem ATIVA para o mesmo serviço da mesma empresa é recusada (cobrança duplicada)');
insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nfse_plano', 'stripe');
select homolog_test.expect(true, 'T261 outro serviço da mesma empresa pode ter outra origem');
insert into public.billing_source_assignments (tenant_id, service_key, source) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'honorarios_contabeis', 'stripe');
select homolog_test.expect(true, 'T262 o mesmo serviço em outra empresa é independente');
select homolog_test.expect_error($$insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'servico_avulso:Abertura!', 'stripe')$$, 'T263 código de serviço fora da lista fechada é recusado');
select homolog_test.expect_error($$insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'servico_avulso:certidao', 'paypal')$$, 'T264 origem fora da lista é recusada');
select homolog_test.expect_error($$update public.billing_source_assignments set source = 'stripe' where id = 'f0000000-0000-4000-8000-000000000001'$$, 'T265 origem não muda por update: encerra e registra outra');
update public.billing_source_assignments set status = 'encerrada', ended_at = now() where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'honorarios_contabeis', 'stripe');
select homolog_test.expect(true, 'T266 depois de encerrar a origem antiga, a nova pode ser registrada');
select homolog_test.expect_error($$update public.billing_source_assignments set status = 'ativa', ended_at = null where id = 'f0000000-0000-4000-8000-000000000001'$$, 'T267 origem encerrada não volta a ficar ativa (histórico)');
select homolog_test.expect_error($$update public.billing_source_assignments set status = 'encerrada' where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$, 'T268 encerrar sem data de fim é recusado');

-- Leitura: cliente vê só a própria empresa; ninguém escreve pelo navegador.
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.billing_source_assignments) = 3 and (select count(*) from public.billing_source_assignments where tenant_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0, 'T269 cliente A lê só as origens da empresa A');
select homolog_test.expect_error($$insert into public.billing_source_assignments (tenant_id, service_key, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'servico_avulso:certidao', 'stripe')$$, 'T270 cliente não registra origem de cobrança');
select homolog_test.expect_error($$update public.billing_source_assignments set note = 'x'$$, 'T271 cliente não altera origem de cobrança');
reset role;
select homolog_test.act_as(null);
select homolog_test.expect_error($$select count(*) from public.billing_source_assignments$$, 'T272 visitante anônimo não lê');
reset role;
rollback;

drop schema homolog_test cascade;
