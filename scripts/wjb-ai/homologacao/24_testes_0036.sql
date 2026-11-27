\set ON_ERROR_STOP on
-- Bateria da 0036: ciclo de vida do certificado (registro, rotação,
-- bloqueio permanente, avisos de vencimento). Só dados fictícios.
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
create function homolog_test.cert(p_id uuid, p_role text, p_tenant uuid, p_fp text, p_until interval default interval '365 days') returns void
language sql as $$
  -- 0037: chave pública obrigatória; titular de cliente = CNPJ da empresa.
  insert into public.fiscal_certificates (id, role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind,
    valid_from, valid_until, vault_reference, policy_checked_at)
  values (p_id, p_role, p_tenant, p_fp, encode(sha256(convert_to(p_fp, 'UTF8')), 'hex'),
    case when p_role = 'wjb' then '00000000000191'
         else regexp_replace((select cnpj from public.tenants where id = p_tenant), '\D', '', 'g') end,
    'A1', now() - interval '1 day', now() + p_until, 'vault://teste/' || p_id, now())
$$;
grant execute on all functions in schema homolog_test to authenticated, service_role, anon;

begin;
set local role service_role;
select homolog_test.cert('d0000000-0000-4000-8000-000000000001', 'wjb', null, repeat('1', 64));
select homolog_test.expect((select status from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000001') = 'pendente', 'T200 certificado novo entra como pendente');
select homolog_test.expect_error($$insert into public.fiscal_certificates (role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind, valid_from, valid_until, vault_reference, policy_checked_at, status) values ('wjb', null, repeat('2',64), repeat('e',64), '00000000000191', 'A1', now(), now() + interval '1 year', 'vault://teste/x', now(), 'ativo')$$, 'T201 não entra já ativo');
select homolog_test.expect_error($$insert into public.fiscal_certificates (role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind, valid_from, valid_until, vault_reference, policy_checked_at) values ('wjb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('2',64), repeat('e',64), '00000000000191', 'A1', now(), now() + interval '1 year', 'vault://teste/x', now())$$, 'T202 certificado da WJB não pertence a empresa cliente');
select homolog_test.expect_error($$insert into public.fiscal_certificates (role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind, valid_from, valid_until, vault_reference, policy_checked_at) values ('wjb', null, repeat('2',64), repeat('e',64), '00000000000191', 'A1', now(), now() + interval '1 year', '/Users/alguem/cert.pfx', now())$$, 'T203 referência fora do cofre é recusada');
select public.rotate_fiscal_certificate('d0000000-0000-4000-8000-000000000001');
select homolog_test.expect((select status from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000001') = 'ativo', 'T204 primeira rotação ativa o certificado');
select homolog_test.cert('d0000000-0000-4000-8000-000000000002', 'wjb', null, repeat('2', 64));
select homolog_test.expect_error($$update public.fiscal_certificates set status = 'ativo' where id = 'd0000000-0000-4000-8000-000000000002'$$, 'T205 dois ativos para o mesmo titular são recusados');
select homolog_test.expect(public.rotate_fiscal_certificate('d0000000-0000-4000-8000-000000000002') = 'd0000000-0000-4000-8000-000000000001', 'T206 rotação devolve o certificado substituído');
select homolog_test.expect((select status from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000001') = 'substituido'
  and (select status from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000002') = 'ativo', 'T207 antigo substituído, novo ativo');
select homolog_test.expect((select reason from public.fiscal_certificate_blocklist where fingerprint_sha256 = repeat('1', 64)) = 'substituido', 'T208 substituído entra na lista permanente');
select homolog_test.expect_error($$update public.fiscal_certificates set status = 'ativo' where id = 'd0000000-0000-4000-8000-000000000001'$$, 'T209 substituído nunca volta a ser ativo');
select homolog_test.expect_error($$insert into public.fiscal_certificates (role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, kind, valid_from, valid_until, vault_reference, policy_checked_at) values ('wjb', null, repeat('1',64), repeat('f',64), '00000000000191', 'A1', now(), now() + interval '1 year', 'vault://teste/y', now())$$, 'T210 recadastrar impressão digital bloqueada é recusado');
select homolog_test.expect_error($$update public.fiscal_certificates set valid_until = now() + interval '10 years' where id = 'd0000000-0000-4000-8000-000000000002'$$, 'T211 validade é imutável');
select homolog_test.expect_error($$update public.fiscal_certificates set vault_reference = 'vault://teste/outro' where id = 'd0000000-0000-4000-8000-000000000002'$$, 'T212 troca silenciosa do material do cofre é recusada');
select homolog_test.expect_error($$delete from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000002'$$, 'T213 registro não é apagado');
select homolog_test.expect_error($$delete from public.fiscal_certificate_blocklist$$, 'T214 nem o servidor remove um bloqueio');
select homolog_test.expect_error($$update public.fiscal_certificate_blocklist set reason = 'revogado'$$, 'T215 nem o servidor altera um bloqueio');
select homolog_test.expect_error($$truncate public.fiscal_certificate_blocklist$$, 'T216 nem o servidor esvazia a lista');
select homolog_test.cert('d0000000-0000-4000-8000-000000000003', 'wjb', null, repeat('3', 64), interval '-1 minute' + interval '2 days');
select homolog_test.cert('d0000000-0000-4000-8000-000000000004', 'cliente', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('4', 64));
select public.rotate_fiscal_certificate('d0000000-0000-4000-8000-000000000004');
select homolog_test.cert('d0000000-0000-4000-8000-000000000005', 'cliente', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('5', 64));
select public.rotate_fiscal_certificate('d0000000-0000-4000-8000-000000000005');
select homolog_test.expect((select count(*) from public.fiscal_certificates where status = 'ativo') = 3, 'T217 um ativo por titular: WJB, empresa A e empresa B');
-- Bloquear por impressão digital retira o certificado ativo na hora.
select public.block_fiscal_certificate(upper(regexp_replace(repeat('4', 64), '(..)', '\1:', 'g')), 'comprometido');
select homolog_test.expect((select status from public.fiscal_certificates where id = 'd0000000-0000-4000-8000-000000000004') = 'bloqueado', 'T218 bloqueio (com dois-pontos e maiúsculas) retira o certificado ativo');
select homolog_test.expect_error($$select public.block_fiscal_certificate('abc', 'comprometido')$$, 'T219 impressão digital inválida é recusada');
insert into public.fiscal_certificate_expiry_notices (certificate_id, milestone) values ('d0000000-0000-4000-8000-000000000002', 90);
select homolog_test.expect_error($$insert into public.fiscal_certificate_expiry_notices (certificate_id, milestone) values ('d0000000-0000-4000-8000-000000000002', 90)$$, 'T220 aviso do mesmo marco não repete');
select homolog_test.expect_error($$insert into public.fiscal_certificate_expiry_notices (certificate_id, milestone) values ('d0000000-0000-4000-8000-000000000002', 45)$$, 'T221 só os marcos 90/60/30/15/7/0');

-- Permissões.
reset role;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
select homolog_test.expect((select count(id) from public.fiscal_certificates) = 5, 'T222 equipe com MFA lê o registro');
select homolog_test.expect_error($$update public.fiscal_certificates set status = 'bloqueado' where id = 'd0000000-0000-4000-8000-000000000002'$$, 'T223 equipe não altera o registro direto');
select homolog_test.expect_error($$select public.rotate_fiscal_certificate('d0000000-0000-4000-8000-000000000003')$$, 'T224 equipe não chama a rotação (só o servidor)');
select homolog_test.expect_error($$select public.block_fiscal_certificate(repeat('6', 64), 'comprometido')$$, 'T225 contador não bloqueia (só super admin)');
reset role;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333', 'aal1');
select homolog_test.expect((select count(id) from public.fiscal_certificates) = 0, 'T226 equipe sem MFA (aal1) não vê o registro');
reset role;
select homolog_test.act_as('66666666-6666-4666-8666-666666666666', 'aal1');
select homolog_test.expect_error($$select public.block_fiscal_certificate(repeat('6', 64), 'comprometido')$$, 'T227 super admin sem MFA não bloqueia');
reset role;
select homolog_test.act_as('66666666-6666-4666-8666-666666666666');
select public.block_fiscal_certificate(repeat('6', 64), 'comprometido');
select homolog_test.expect((select blocked_by from public.fiscal_certificate_blocklist where fingerprint_sha256 = repeat('6', 64)) = '66666666-6666-4666-8666-666666666666', 'T228 super admin com MFA bloqueia e fica registrado');
reset role;
select homolog_test.act_as('11111111-1111-4111-8111-111111111111');
select homolog_test.expect((select count(id) from public.fiscal_certificates) = 0
  and (select count(*) from public.fiscal_certificate_blocklist) = 0, 'T229 cliente da empresa A não vê certificados (nem o da própria empresa)');
select homolog_test.expect_error($$select public.block_fiscal_certificate(repeat('7', 64), 'comprometido')$$, 'T230 cliente não bloqueia');
reset role;
select homolog_test.act_as(null);
select homolog_test.expect_error($$select count(id) from public.fiscal_certificates$$, 'T231 anônimo não lê o registro');
reset role;
-- Empresa apagada: só os certificados dela saem (cascata); bloqueios ficam.
insert into public.tenants (id, name, cnpj) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Empresa Ficticia C','00.000.000/0003-53');
set local role service_role;
select homolog_test.cert('d0000000-0000-4000-8000-000000000008', 'cliente', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', repeat('8', 64));
reset role;
delete from public.tenants where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select homolog_test.expect((select count(*) from public.fiscal_certificates where tenant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') = 0
  and (select count(*) from public.fiscal_certificate_blocklist) >= 3, 'T232 apagar a empresa remove só os certificados dela; a lista de bloqueio permanece');
rollback;

drop schema homolog_test cascade;
