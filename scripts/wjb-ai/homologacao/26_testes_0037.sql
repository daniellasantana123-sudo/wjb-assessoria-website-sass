\set ON_ERROR_STOP on
-- Bateria da 0037: chave pública bloqueada, titular de cliente, rotação do
-- mesmo titular com outra chave, exclusão de perfil, leitura por coluna.
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
-- p_holder: documento do titular; p_spki: chave pública fictícia.
create function homolog_test.cert(p_id uuid, p_tenant uuid, p_fp text, p_spki text, p_holder text, p_by uuid default null) returns void
language sql as $$
  insert into public.fiscal_certificates (id, role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind,
    valid_from, valid_until, vault_reference, policy_checked_at, created_by)
  values (p_id, case when p_tenant is null then 'wjb' else 'cliente' end, p_tenant, p_fp, p_spki, p_holder,
    'A1', now() - interval '1 day', now() + interval '365 days', 'vault://teste/' || p_id, now(), p_by)
$$;
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

begin;
set local role service_role;
select homolog_test.expect_error($$insert into public.fiscal_certificates (role, tenant_id, fingerprint_sha256, holder_document, kind, valid_from, valid_until, vault_reference, policy_checked_at) values ('wjb', null, repeat('9',64), '00000000000191', 'A1', now(), now() + interval '1 year', 'vault://teste/s', now())$$, 'T240 sem chave pública não registra');
select homolog_test.expect_error($$select homolog_test.cert('e0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('1',64), repeat('a',64), '00000000000272')$$, 'T241 certificado de cliente com CNPJ de outra empresa é recusado');
-- Cliente A (CNPJ fictício 00.000.000/0001-91): ativa e tenta girar com a MESMA chave (reemissão com o mesmo CSR).
select homolog_test.cert('e0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('2',64), repeat('b',64), '00000000000191');
select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000002');
select homolog_test.cert('e0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('3',64), repeat('b',64), '00000000000191');
select homolog_test.expect_error($$select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000003')$$, 'T243 rotação para certificado com a MESMA chave é recusada');
select homolog_test.cert('e0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('4',64), repeat('c',64), '00000000000191');
select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000004');
select homolog_test.expect((select reason from public.fiscal_certificate_key_blocklist where spki_sha256 = repeat('b',64)) = 'substituido', 'T244 a chave do substituído entra na lista permanente de chaves');
select homolog_test.expect_error($$select homolog_test.cert('e0000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('5',64), repeat('b',64), '00000000000191')$$, 'T245 certificado novo com chave bloqueada não é registrado (reemissão com o mesmo par de chaves)');
select homolog_test.expect_error($$delete from public.fiscal_certificate_key_blocklist$$, 'T246 nem o servidor remove um bloqueio de chave');
select homolog_test.expect_error($$truncate public.fiscal_certificate_key_blocklist$$, 'T247 nem o servidor esvazia a lista de chaves');
select homolog_test.expect_error($$update public.fiscal_certificate_key_blocklist set reason = 'revogado'$$, 'T247b nem o servidor altera um bloqueio de chave');
-- WJB: rotação para outro titular é recusada no banco.
select homolog_test.cert('e0000000-0000-4000-8000-000000000006', null, repeat('6',64), repeat('d',64), '00000000000191');
select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000006');
select homolog_test.cert('e0000000-0000-4000-8000-000000000007', null, repeat('7',64), repeat('e',64), '99888777000155');
select homolog_test.expect_error($$select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000007')$$, 'T248 rotação da WJB para outro titular é recusada');
reset role;

-- M3: perfil apagado (saída de pessoa, LGPD) com bloqueio e certificado retirado.
insert into auth.users (id, email, raw_user_meta_data) values ('88888888-8888-4888-8888-888888888888','saindo@exemplo.test','{"full_name":"Pessoa Saindo"}');
update public.profiles set is_wjb_staff = true, staff_role = 'super_admin' where id = '88888888-8888-4888-8888-888888888888';
select homolog_test.act_as('88888888-8888-4888-8888-888888888888');
select public.block_fiscal_certificate(repeat('8', 64), 'comprometido');
reset role;
set local role service_role;
select homolog_test.cert('e0000000-0000-4000-8000-000000000009', null, repeat('a',63) || '9', repeat('f',64), '00000000000191', '88888888-8888-4888-8888-888888888888');
select public.rotate_fiscal_certificate('e0000000-0000-4000-8000-000000000009');
reset role;
delete from auth.users where id = '88888888-8888-4888-8888-888888888888';
select homolog_test.expect(not exists (select 1 from public.profiles where id = '88888888-8888-4888-8888-888888888888'), 'T249 perfil de quem bloqueou e de quem cadastrou pode ser apagado');
select homolog_test.expect((select blocked_by from public.fiscal_certificate_blocklist where fingerprint_sha256 = repeat('8',64)) is null
  and (select status from public.fiscal_certificates where id = 'e0000000-0000-4000-8000-000000000006') = 'substituido', 'T250 o bloqueio e o histórico continuam, só sem o autor');
set local role service_role;
select homolog_test.expect_error($$update public.fiscal_certificate_blocklist set blocked_by = null, reason = 'revogado' where fingerprint_sha256 = repeat('8',64)$$, 'T251 a exceção do autor não permite mudar mais nada');
reset role;

-- B2/B3: leitura por coluna e MFA nos avisos.
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect((select count(id) from public.fiscal_certificates) >= 5, 'T252 equipe com MFA lê as colunas públicas');
select homolog_test.expect_error($$select holder_document from public.fiscal_certificates$$, 'T253 equipe não lê o documento do titular pela API');
select homolog_test.expect_error($$select vault_reference from public.fiscal_certificates$$, 'T254 equipe não lê a referência do cofre pela API');
reset role;
set local role service_role;
insert into public.fiscal_certificate_expiry_notices (certificate_id, milestone) values ('e0000000-0000-4000-8000-000000000004', 30);
reset role;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333', 'aal1');
select homolog_test.expect((select count(*) from public.fiscal_certificate_expiry_notices) = 0, 'T255 sem MFA (aal1) não lê os avisos de vencimento');
reset role;
rollback;

drop schema homolog_test cascade;
