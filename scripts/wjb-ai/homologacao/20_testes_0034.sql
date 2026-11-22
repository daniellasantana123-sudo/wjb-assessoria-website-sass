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


-- Como o servidor (service role):
set role service_role;
select homolog_test.expect(not public.rate_limit_hit('teste:aaaaaaaaaaaa', 60, 2) and not public.rate_limit_hit('teste:aaaaaaaaaaaa', 60, 2), 'T120 até o limite passa');
select homolog_test.expect(public.rate_limit_hit('teste:aaaaaaaaaaaa', 60, 2), 'T121 acima do limite é barrado');
select homolog_test.expect(not public.rate_limit_hit('teste:bbbbbbbbbbbb', 60, 2), 'T122 outra chave tem contador próprio');
reset role;
update public.rate_limit_buckets set window_start = now() - interval '2 minutes' where bucket = 'teste:aaaaaaaaaaaa';
set role service_role;
select homolog_test.expect(not public.rate_limit_hit('teste:aaaaaaaaaaaa', 60, 2), 'T123 janela vencida recomeça a contagem');
select homolog_test.expect_error($$select public.rate_limit_hit('teste:cccccccccccc', 0, 2)$$, 'T124 parâmetros inválidos recusados');
reset role;
begin;
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect_error($$select public.rate_limit_hit('teste:dddddddddddd', 60, 5)$$, 'T125 usuário logado não usa o limitador direto');
select homolog_test.expect_error($$select count(*) from public.rate_limit_buckets$$, 'T126 usuário logado não lê os contadores');
select homolog_test.act_as(null);
select homolog_test.expect_error($$select public.rate_limit_hit('teste:eeeeeeeeeeee', 60, 5)$$, 'T127 visitante anônimo não usa o limitador direto');
rollback;
select homolog_test.expect((select count(*) from pg_indexes where schemaname='public' and indexname in ('fiscal_request_events_tenant_idx','fiscal_issuance_attempts_tenant_idx','fiscal_request_versions_tenant_idx','commercial_acceptances_tenant_idx','commercial_subscriptions_tenant_idx')) = 5, 'T128 índices de tenant criados');
delete from public.rate_limit_buckets where bucket like 'teste:%';

drop schema homolog_test cascade;
