\set ON_ERROR_STOP on
-- Bateria de homologação da migration 0024. Cada bloco falha com exceção
-- se a regra não se comportar como esperado.

create schema homolog_test;
grant usage on schema homolog_test to authenticated, service_role, anon;

create function homolog_test.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  if p_user is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;

create function homolog_test.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK  % (bloqueado: %)', p_label, sqlstate;
    return;
  end;
  raise exception 'FALHA % - deveria ter sido bloqueado', p_label;
end $$;

create function homolog_test.expect(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not p_cond then raise exception 'FALHA %', p_label; end if;
  raise notice 'OK  %', p_label;
end $$;
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

-- Pedidos semeados pelo servidor (service role), um por empresa.
insert into public.fiscal_requests (id, tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by) values
 ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','key-a-1','{"v":1}','h1','11111111-1111-4111-8111-111111111111'),
 ('b1000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','key-b-1','{"v":1}','h2','22222222-2222-4222-8222-222222222222');
insert into public.fiscal_profiles (id, tenant_id, version, created_by) values
 ('f1000000-0000-4000-8000-00000000000a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'33333333-3333-4333-8333-333333333333'),
 ('f1000000-0000-4000-8000-00000000000b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'33333333-3333-4333-8333-333333333333');

-- ---------------- Isolamento entre empresas ----------------
begin;
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.fiscal_requests where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0, 'T01 cliente A não vê pedidos da empresa B');
select homolog_test.expect((select count(*) from public.fiscal_requests) = 1, 'T02 cliente A vê só o próprio pedido');
select homolog_test.expect((select count(*) from public.fiscal_profiles where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0, 'T03 cliente A não vê perfil fiscal da empresa B');
select homolog_test.expect_error($$insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','x','{}','h','11111111-1111-4111-8111-111111111111')$$, 'T04 cliente A não cria pedido na empresa B');
rollback;

-- ---------------- Criação, consulta e alteração ----------------
begin;
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','key-a-2','{"v":2}','h3','11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.fiscal_requests where idempotency_key = 'key-a-2') = 1, 'T05 cliente cria pedido na própria empresa e consulta');
select homolog_test.expect_error($$insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','key-a-3','{}','h','11111111-1111-4111-8111-111111111111','AUTORIZADA')$$, 'T06 cliente não cria pedido já AUTORIZADA');
select homolog_test.expect_error($$insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','key-a-4','{}','h','22222222-2222-4222-8222-222222222222')$$, 'T07 cliente não cria pedido em nome de outra pessoa');
select homolog_test.expect_error($$insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','key-a-2','{}','h','11111111-1111-4111-8111-111111111111')$$, 'T08 mesma chave de idempotência na mesma empresa é recusada');
with u as (update public.fiscal_requests set status = 'CONFIRMADA' where idempotency_key = 'key-a-1' returning 1)
select homolog_test.expect((select count(*) from u) = 0, 'T09 cliente não altera pedido (sem policy de update)');
rollback;

begin;
select homolog_test.act_as('22222222-2222-4222-8222-222222222222');
insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash, created_by)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','key-a-1','{}','h','22222222-2222-4222-8222-222222222222');
select homolog_test.expect(true, 'T10 a mesma chave em OUTRA empresa é permitida (chave é por empresa)');
rollback;

begin;
select homolog_test.act_as('55555555-5555-4555-8555-555555555555');
with u as (update public.fiscal_requests set status = 'REVISAO_HUMANA' where idempotency_key = 'key-a-1' returning 1)
select homolog_test.expect((select count(*) from u) = 1, 'T11 equipe move pedido para REVISAO_HUMANA');
select homolog_test.expect_error($$update public.fiscal_requests set status = 'AUTORIZADA' where idempotency_key = 'key-a-1'$$, 'T12 equipe não marca AUTORIZADA');
select homolog_test.expect_error($$insert into public.fiscal_request_events (request_id, tenant_id, to_status) values ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AUTORIZADA')$$, 'T13 usuário não grava eventos (só o servidor)');
select homolog_test.expect_error($$insert into public.fiscal_issuance_attempts (request_id, tenant_id, environment, idempotency_key, outcome, simulated) values ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mock','key-a-1','AUTORIZADA',true)$$, 'T14 usuário não grava tentativa de envio');
rollback;

begin;
set local role service_role;
insert into public.fiscal_issuance_attempts (request_id, tenant_id, environment, idempotency_key, outcome, simulated)
  values ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mock','key-a-1','AUTORIZADA',true);
select homolog_test.expect_error($$insert into public.fiscal_issuance_attempts (request_id, tenant_id, environment, idempotency_key, outcome, simulated) values ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mock','key-a-1','AUTORIZADA',true)$$, 'T15 segunda tentativa AUTORIZADA do mesmo pedido é recusada pelo banco');
rollback;

begin;
select homolog_test.act_as(null);
select homolog_test.expect((select count(*) from public.fiscal_requests) = 0, 'T16 visitante anônimo não lê pedidos');
rollback;

-- ---------------- Permissão fiscal_profile.approve ----------------
begin;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect_error($$select public.approve_fiscal_profile('f1000000-0000-4000-8000-00000000000a','Conferido com o contrato social')$$, 'T17 contador SEM concessão não aprova');
select homolog_test.expect_error($$update public.fiscal_profiles set status = 'approved' where id = 'f1000000-0000-4000-8000-00000000000a'$$, 'T18 aprovar editando a tabela direto é bloqueado');
select homolog_test.expect_error($$select public.grant_fiscal_profile_approver('33333333-3333-4333-8333-333333333333', null, 'Autoconcessao indevida')$$, 'T19 contador não concede permissão a si mesmo');
rollback;

begin;
select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
select homolog_test.expect_error($$select public.grant_fiscal_profile_approver('55555555-5555-4555-8555-555555555555', null, 'Atendimento nao pode aprovar')$$, 'T20 permissão não pode ir para Atendimento');
select homolog_test.expect_error($$select public.grant_fiscal_profile_approver('33333333-3333-4333-8333-333333333333', null, 'curta')$$, 'T21 concessão exige motivo');
select public.grant_fiscal_profile_approver('33333333-3333-4333-8333-333333333333', null, 'Contador responsavel pela carteira');
select public.grant_fiscal_profile_approver('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Contador somente da empresa A');
select homolog_test.expect((select count(*) from public.audit_log where action = 'fiscal.approver_granted') = 2, 'T22 concessões registradas no audit_log');
select homolog_test.expect_error($$select public.approve_fiscal_profile('f1000000-0000-4000-8000-00000000000a','Super admin tentando aprovar')$$, 'T23 super_admin concede, mas não aprova perfil');

select homolog_test.act_as('44444444-4444-4444-8444-444444444444');
select homolog_test.expect(not public.can_approve_fiscal_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T24 contador sem concessão continua sem a permissão (não é automática)');

select homolog_test.act_as('77777777-7777-4777-8777-777777777777');
select homolog_test.expect_error($$select public.approve_fiscal_profile('f1000000-0000-4000-8000-00000000000b','Tentando aprovar empresa B')$$, 'T25 concessão restrita à empresa A não aprova a empresa B');

select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect_error($$select public.approve_fiscal_profile('f1000000-0000-4000-8000-00000000000a','curta')$$, 'T26 aprovação exige justificativa');
select public.approve_fiscal_profile('f1000000-0000-4000-8000-00000000000a', 'Conferido com o cartao CNPJ ficticio');
select homolog_test.expect((select status = 'approved' and approved_by = '33333333-3333-4333-8333-333333333333' and approval_justification is not null from public.fiscal_profiles where id = 'f1000000-0000-4000-8000-00000000000a'), 'T27 perfil aprovado registra quem e justificativa');
select homolog_test.expect((select count(*) = 1 from public.fiscal_profile_approvals where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and profile_version = 1 and approved_at is not null), 'T28 histórico registra empresa, versão e data');
select homolog_test.expect((select count(*) = 1 from public.audit_log where action = 'fiscal.profile_approved'), 'T29 aprovação no audit_log');
with u as (update public.fiscal_profiles set max_amount_cents_without_review = 999999 where id = 'f1000000-0000-4000-8000-00000000000a' returning 1)
select homolog_test.expect((select count(*) from u) = 0, 'T30 perfil aprovado é imutável (nova versão em vez de edição)');

select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
select public.revoke_fiscal_profile_approver(
  (select id from public.fiscal_profile_approver_grants where profile_id = '33333333-3333-4333-8333-333333333333' and revoked_at is null),
  'Revogacao de teste ficticio');
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect(not public.can_approve_fiscal_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T31 revogação retira a permissão na hora');

reset role;
-- Sem usuário no JWT, como o SQL Editor (a 0022 bloqueia mudança de status vinda de usuário).
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set status = 'suspended' where id = '77777777-7777-4777-8777-777777777777';
select homolog_test.act_as('77777777-7777-4777-8777-777777777777');
select homolog_test.expect(not public.can_approve_fiscal_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'T32 contador suspenso perde a permissão mesmo com concessão ativa');
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.fiscal_profile_approver_grants) = 0, 'T33 cliente não enxerga concessões');
rollback;

-- ---------------- Integridade referencial ----------------
begin;
select homolog_test.expect_error($$insert into public.fiscal_requests (tenant_id, idempotency_key, draft_snapshot, draft_hash) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','k','{}','h')$$, 'T34 pedido de empresa inexistente é recusado (FK)');
insert into public.fiscal_request_events (request_id, tenant_id, to_status) values ('b1000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TRIAGEM');
delete from public.tenants where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select homolog_test.expect((select count(*) from public.fiscal_requests where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.fiscal_request_events where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0, 'T35 apagar a empresa remove os dados fiscais dela em cascata');
select homolog_test.expect((select count(*) from public.fiscal_requests where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 1, 'T36 dados da outra empresa intactos');
rollback;

-- ---------------- Tabelas existentes continuam funcionando ----------------
begin;
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(*) from public.obligations) = 1, 'T37 RLS de obrigações (tabela existente) inalterada');
select homolog_test.expect((select count(*) from public.tenants) = 1, 'T38 RLS de empresas (tabela existente) inalterada');
rollback;

drop schema homolog_test cascade;
