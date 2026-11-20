\set ON_ERROR_STOP on
-- Verificação depois da numeração concorrente (run.sh disparou 20 pedidos
-- distintos + 10 chamadas repetidas do pedido 1, todas em paralelo).
select homolog_test.expect((select count(*) from public.fiscal_dps_numbers) = 20, 'T48 20 pedidos receberam exatamente 20 números');
select homolog_test.expect((select count(distinct number) from public.fiscal_dps_numbers) = 20
  and (select min(number) from public.fiscal_dps_numbers) = 1
  and (select max(number) from public.fiscal_dps_numbers) = 20, 'T49 números de 1 a 20, sem repetição e sem lacuna');
select homolog_test.expect((select last_number from public.fiscal_dps_series where active) = 20, 'T50 contador da série terminou em 20');

begin;
set local role service_role;
select homolog_test.expect((select number from public.allocate_dps_number('c0000000-0000-4000-8000-000000000001','simulado'))
  = (select number from public.fiscal_dps_numbers where request_id = 'c0000000-0000-4000-8000-000000000001'), 'T51 reenvio do mesmo pedido devolve o MESMO número');
select homolog_test.expect_error($$select * from public.allocate_dps_number('c0000000-0000-4000-8000-000000000001','producao_restrita')$$, 'T52 pedido numerado não muda de ambiente');
rollback;
select homolog_test.expect_error($$insert into public.fiscal_dps_numbers (request_id, tenant_id, series_id, environment, emitter_document, series, number)
  select 'c1000000-0000-4000-8000-000000000001', tenant_id, series_id, environment, emitter_document, series, number
  from public.fiscal_dps_numbers limit 1$$, 'T53 banco recusa o mesmo número para outro pedido');

-- ---------------- Autorização de emissão ----------------
begin;
select homolog_test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.fiscal_authorization_grants (id, tenant_id, kind, scope, valid_until, evidence_reference, emission_model,
  certificate_holder_document, certificate_valid_from, certificate_valid_until, certificate_fingerprint_sha256, certificate_vault_reference)
values ('d0000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','procuracao','NFS-e Nacional','2027-11-20',
  'Pasta fictícia do cliente','wjb_procuracao','00000000000272','2026-01-01','2027-01-01', repeat('a', 64), 'vault://ficticio/wjb-ecnpj');
select homolog_test.expect_error($$insert into public.fiscal_authorization_grants (tenant_id, kind, scope, valid_until, certificate_vault_reference)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','procuracao','x','2027-01-01','-----BEGIN PRIVATE KEY-----MIIE')$$, 'T54 referência ao cofre não aceita chave colada');
select homolog_test.expect_error($$insert into public.fiscal_authorization_grants (tenant_id, kind, scope, valid_until, evidence_reference)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','procuracao','x','2027-01-01','senha do certificado: 1234')$$, 'T55 evidência não aceita senha');
select homolog_test.expect_error($$insert into public.fiscal_authorization_grants (tenant_id, kind, scope, valid_until, certificate_valid_from, certificate_valid_until)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','procuracao','x','2027-01-01','2027-01-01','2026-01-01')$$, 'T56 validade do certificado incoerente é recusada');
select homolog_test.expect_error($$update public.fiscal_authorization_grants set revoked_at = now(), revoke_reason = 'curto' where id = 'd0000000-0000-4000-8000-000000000001'$$, 'T57 revogação exige motivo');
select homolog_test.expect_error($$update public.fiscal_authorization_grants set status = 'revoked' where id = 'd0000000-0000-4000-8000-000000000001'$$, 'T58 status revogado só pela revogação com motivo');
update public.fiscal_authorization_grants set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Cliente revogou a procuração (fictício)'
 where id = 'd0000000-0000-4000-8000-000000000001';
select homolog_test.expect((select status from public.fiscal_authorization_grants where id = 'd0000000-0000-4000-8000-000000000001') = 'revoked', 'T59 revogação muda o status para revoked');
select homolog_test.expect_error($$update public.fiscal_authorization_grants set revoked_at = null, status = 'active' where id = 'd0000000-0000-4000-8000-000000000001'$$, 'T60 autorização revogada não volta a valer');
select homolog_test.expect_error($$delete from public.fiscal_authorization_grants where id = 'd0000000-0000-4000-8000-000000000001'$$, 'T61 autorização não pode ser apagada (histórico)');
select homolog_test.act_as('22222222-2222-4222-8222-222222222222');
select homolog_test.expect((select count(*) from public.fiscal_dps_numbers) = 0 and (select count(*) from public.fiscal_dps_series) = 0, 'T62 cliente da empresa B não vê série nem números da empresa A');
rollback;

drop schema homolog_test cascade;
