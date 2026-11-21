\set ON_ERROR_STOP on
-- Bateria da 0029: atribuição, prioridade e prazo da revisão.
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

insert into public.fiscal_requests (id, tenant_id, idempotency_key, draft_snapshot, draft_hash, status)
values ('e0000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rev-1','{"v":1}','hrev','TRIAGEM');

begin;
select homolog_test.act_as('55555555-5555-4555-8555-555555555555');
update public.fiscal_requests set status = 'REVISAO_HUMANA' where id = 'e0000000-0000-4000-8000-000000000001';
select homolog_test.expect((select review_due_at between now() + interval '23 hours' and now() + interval '25 hours' from public.fiscal_requests where id = 'e0000000-0000-4000-8000-000000000001'), 'T71 entrar em revisão define o prazo (normal = 24 h)');
update public.fiscal_requests set priority = 'urgente' where id = 'e0000000-0000-4000-8000-000000000001';
select homolog_test.expect((select review_due_at < now() + interval '5 hours' from public.fiscal_requests where id = 'e0000000-0000-4000-8000-000000000001'), 'T72 prioridade urgente recalcula o prazo (4 h)');
update public.fiscal_requests set assigned_to = '33333333-3333-4333-8333-333333333333' where id = 'e0000000-0000-4000-8000-000000000001';
select homolog_test.expect((select assigned_to from public.fiscal_requests where id = 'e0000000-0000-4000-8000-000000000001') = '33333333-3333-4333-8333-333333333333', 'T73 equipe atribui a revisão a um contador');
select homolog_test.expect_error($$update public.fiscal_requests set assigned_to = '11111111-1111-4111-8111-111111111111' where id = 'e0000000-0000-4000-8000-000000000001'$$, 'T74 revisão não pode ser atribuída a cliente');
select homolog_test.expect_error($$update public.fiscal_requests set priority = 'altissima' where id = 'e0000000-0000-4000-8000-000000000001'$$, 'T75 prioridade fora da lista é recusada');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
update public.fiscal_requests set priority = 'urgente', assigned_to = null where id = 'e0000000-0000-4000-8000-000000000001';
reset role;
select homolog_test.expect((select assigned_to is not null from public.fiscal_requests where id = 'e0000000-0000-4000-8000-000000000001'), 'T76 cliente não altera atribuição nem prioridade');
rollback;

drop schema homolog_test cascade;
