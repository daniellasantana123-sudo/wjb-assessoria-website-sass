-- Dados 100% FICTÍCIOS para homologação. Nenhum CPF/CNPJ real.
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','cliente.a@exemplo.test','{"full_name":"Cliente A"}'),
 ('22222222-2222-4222-8222-222222222222','cliente.b@exemplo.test','{"full_name":"Cliente B"}'),
 ('33333333-3333-4333-8333-333333333333','contador.autorizado@exemplo.test','{"full_name":"Contador Autorizado"}'),
 ('44444444-4444-4444-8444-444444444444','contador.sem.permissao@exemplo.test','{"full_name":"Contador Sem Permissao"}'),
 ('55555555-5555-4555-8555-555555555555','atendimento@exemplo.test','{"full_name":"Atendimento"}'),
 ('66666666-6666-4666-8666-666666666666','superadmin@exemplo.test','{"full_name":"Super Admin"}'),
 ('77777777-7777-4777-8777-777777777777','contador.so.a@exemplo.test','{"full_name":"Contador So A"}');

update public.profiles set is_wjb_staff = true, staff_role = 'contador'
 where id in ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777');
update public.profiles set is_wjb_staff = true, staff_role = 'atendimento' where id = '55555555-5555-4555-8555-555555555555';
update public.profiles set is_wjb_staff = true, staff_role = 'super_admin' where id = '66666666-6666-4666-8666-666666666666';

insert into public.tenants (id, name, cnpj) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Empresa Ficticia A','00.000.000/0001-91'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Empresa Ficticia B','00.000.000/0002-72');

insert into public.tenant_members (tenant_id, profile_id, role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner');

insert into public.obligations (tenant_id, title, due_date) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DAS ficticio A','2026-12-20'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','DAS ficticio B','2026-12-20');
