-- =====================================================================
-- Auditoria NÃO DESTRUTIVA do banco de produção (Fase 10D, 26/11/2026).
--
-- Para o responsável autorizado da WJB rodar no SQL Editor do Supabase do
-- projeto de PRODUÇÃO. Cole o arquivo inteiro e clique em Run: o resultado é
-- UMA tabela (secao | item | valor) só com CONTAGENS e verdadeiro/falso.
-- Nenhum nome, e-mail, CPF, CNPJ ou conteúdo de documento sai daqui.
-- Nomes de tabelas, políticas e buckets aparecem (não são dados pessoais).
--
-- Segurança: a primeira linha deixa a sessão SOMENTE LEITURA. Qualquer
-- tentativa de escrita, mesmo por engano, é recusada pelo próprio Postgres.
-- O script não cria, altera nem apaga nada.
--
-- O que este script NÃO mostra (conferir no painel): backups e retenção
-- (Database > Backups), PITR, plano (Billing), papéis internos com senha
-- (o incidente de 19-20/11) e a lista de usuários do Auth com e-mail.
-- =====================================================================
set default_transaction_read_only = on;
set statement_timeout = '60s';

with
-- contagem exata de uma tabela, só se ela existir
cnt as (
  select n.nspname as s, c.relname as t,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as n
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
),
has as (
  select
    to_regclass('public.profiles') is not null as profiles,
    to_regclass('public.tenants') is not null as tenants,
    to_regclass('public.tenant_members') is not null as tenant_members,
    to_regclass('supabase_migrations.schema_migrations') is not null as migrations_table
),
rows_ as (
  -- 1. Identificação (sem dado pessoal)
  select 1 o, 'identificacao' secao, 'banco' item, current_database() valor
  union all select 1, 'identificacao', 'versao_postgres', current_setting('server_version')
  union all select 1, 'identificacao', 'sessao_somente_leitura', current_setting('default_transaction_read_only')

  -- 2. Autenticação
  union all select 2, 'auth', 'usuarios', (select count(*)::text from auth.users)
  union all select 2, 'auth', 'usuarios_confirmados', (select count(*)::text from auth.users where email_confirmed_at is not null)
  union all select 2, 'auth', 'login_ultimos_30_dias', (select count(*)::text from auth.users where last_sign_in_at > now() - interval '30 days')
  union all select 2, 'auth', 'usuarios_banidos', (select count(*)::text from auth.users where banned_until is not null and banned_until > now())
  union all select 2, 'auth', 'usuarios_com_mfa_verificado', (select count(distinct user_id)::text from auth.mfa_factors where status = 'verified')
  union all select 2, 'auth', 'criado_primeiro', (select coalesce(min(created_at)::date::text, '-') from auth.users)
  union all select 2, 'auth', 'criado_ultimo', (select coalesce(max(created_at)::date::text, '-') from auth.users)

  -- 3. Contagem por tabela (public)
  union all select 3, 'linhas', t, n::text from cnt

  -- 4. Equipe e permissões administrativas
  union all select 4, 'equipe', 'perfis_equipe', (select count(*)::text from public.profiles where is_wjb_staff)
  union all select 4, 'equipe', 'super_admin', (select count(*)::text from public.profiles where staff_role = 'super_admin')
  union all select 4, 'equipe', 'contador', (select count(*)::text from public.profiles where staff_role = 'contador')
  union all select 4, 'equipe', 'atendimento', (select count(*)::text from public.profiles where staff_role = 'atendimento')
  union all select 4, 'equipe', 'super_admin_sem_mfa', (select count(*)::text from public.profiles p where p.staff_role = 'super_admin'
                                                         and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'))
  union all select 4, 'equipe', 'equipe_com_email_de_teste', (select count(*)::text from public.profiles where is_wjb_staff
                                                         and (email ilike '%teste%' or email ilike 'e2e%' or email ilike '%@exemplo%' or email ilike '%test@%'))

  -- 5. Integridade e duplicidades (só contagens)
  union all select 5, 'integridade', 'perfis_sem_usuario_auth', (select count(*)::text from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id))
  union all select 5, 'integridade', 'usuarios_auth_sem_perfil', (select count(*)::text from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id))
  union all select 5, 'integridade', 'emails_duplicados_em_perfis', (select count(*)::text from (select lower(email) from public.profiles where email is not null group by 1 having count(*) > 1) d)
  union all select 5, 'integridade', 'empresas_sem_cnpj', (select count(*)::text from public.tenants where coalesce(cnpj, '') = '')
  union all select 5, 'integridade', 'cnpj_duplicado', (select count(*)::text from (select regexp_replace(cnpj, '\D', '', 'g') from public.tenants where coalesce(cnpj, '') <> '' group by 1 having count(*) > 1) d)
  union all select 5, 'integridade', 'empresas_sem_membro', (select count(*)::text from public.tenants t where not exists (select 1 from public.tenant_members m where m.tenant_id = t.id))
  union all select 5, 'integridade', 'vinculos_sem_empresa', (select count(*)::text from public.tenant_members m where not exists (select 1 from public.tenants t where t.id = m.tenant_id))
  union all select 5, 'integridade', 'vinculos_sem_pessoa', (select count(*)::text from public.tenant_members m where not exists (select 1 from public.profiles p where p.id = m.profile_id))
  union all select 5, 'integridade', 'obrigacoes_sem_empresa', (select count(*)::text from public.obligations o where not exists (select 1 from public.tenants t where t.id = o.tenant_id))
  union all select 5, 'integridade', 'documentos_sem_empresa', (select count(*)::text from public.documents d where not exists (select 1 from public.tenants t where t.id = d.tenant_id))
  union all select 5, 'integridade', 'documentos_sem_arquivo_no_storage', (select count(*)::text from public.documents d where not exists (select 1 from storage.objects s where s.bucket_id = 'documents' and s.name = d.storage_path))
  union all select 5, 'integridade', 'chamados_sem_empresa', (select count(*)::text from public.tickets k where not exists (select 1 from public.tenants t where t.id = k.tenant_id))
  union all select 5, 'integridade', 'notificacoes_sem_destinatario', (select count(*)::text from public.notifications n where not exists (select 1 from public.profiles p where p.id = n.recipient_id))
  union all select 5, 'integridade', 'vinculos_gclick_sem_empresa', (select count(*)::text from public.omie_client_mappings m where not exists (select 1 from public.tenants t where t.id = m.tenant_id))

  -- 6. Objetos do schema public
  union all select 6, 'schema', 'tabelas', (select count(*)::text from pg_tables where schemaname = 'public')
  union all select 6, 'schema', 'views', (select count(*)::text from pg_views where schemaname = 'public')
  union all select 6, 'schema', 'funcoes', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')
  union all select 6, 'schema', 'funcoes_security_definer', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef)
  union all select 6, 'schema', 'security_definer_sem_search_path', (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'nenhuma') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                          where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))
  union all select 6, 'schema', 'gatilhos', (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not g.tgisinternal)
  union all select 6, 'schema', 'restricoes_pk_fk_unique_check', (select string_agg(contype::text || '=' || n, ' ' order by contype::text) from (select contype, count(*) n from pg_constraint c join pg_namespace s on s.oid = c.connamespace where s.nspname = 'public' group by contype) x)
  union all select 6, 'schema', 'indices', (select count(*)::text from pg_indexes where schemaname = 'public')
  union all select 6, 'schema', 'indices_invalidos', (select count(*)::text from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not i.indisvalid)
  union all select 6, 'schema', 'extensoes', (select string_agg(extname, ', ' order by extname) from pg_extension)

  -- 7. RLS e permissões
  union all select 7, 'rls', 'tabelas_sem_rls', (select coalesce(string_agg(tablename, ', ' order by tablename), 'nenhuma') from pg_tables where schemaname = 'public' and not rowsecurity)
  union all select 7, 'rls', 'politicas', (select count(*)::text from pg_policies where schemaname = 'public')
  union all select 7, 'rls', 'tabelas_com_rls_sem_politica', (select coalesce(string_agg(t.tablename, ', ' order by t.tablename), 'nenhuma') from pg_tables t
                                                     where t.schemaname = 'public' and t.rowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename))
  union all select 7, 'rls', 'politicas_using_true_para_anon_ou_public', (select coalesce(string_agg(tablename || '.' || policyname, ', '), 'nenhuma') from pg_policies
                                                     where schemaname = 'public' and qual = 'true' and (roles && array['anon','public']::name[]))
  -- Padrão do Supabase: anon tem permissão de TABELA em public e quem barra é a
  -- RLS. Por isso o que importa é "tabelas_sem_rls" (deve ser "nenhuma").
  union all select 7, 'rls', 'tabelas_com_escrita_concedida_a_anon_rls_decide', (select count(distinct table_name)::text from information_schema.role_table_grants
                                                     where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))
  union all select 7, 'rls', 'guarda_de_colunas_privilegiadas_0022', (select (count(*) > 0)::text from pg_trigger where tgname = 'profiles_guard_privileged_columns')
  union all select 7, 'rls', 'funcoes_de_acesso', (select string_agg(proname, ', ' order by proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                     where n.nspname = 'public' and proname in ('is_staff','is_super_admin','my_tenant_ids','is_tenant_owner'))

  -- 8. Migrations
  union all select 8, 'migrations', 'tabela_de_historico_existe', (select migrations_table::text from has)
  union all select 8, 'migrations', 'm0016_status_da_conta', (select (count(*) > 0)::text from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='status')
  union all select 8, 'migrations', 'm0017_vinculo_gclick', (to_regclass('public.omie_client_mappings') is not null)::text
  union all select 8, 'migrations', 'm0020_obrigacoes_externas', (select (count(*) > 0)::text from information_schema.columns where table_schema='public' and table_name='obligations' and column_name='external_id')
  union all select 8, 'migrations', 'm0022_guarda_de_perfil', (select (count(*) > 0)::text from pg_trigger where tgname = 'profiles_guard_privileged_columns')
  union all select 8, 'migrations', 'm0023_funil_de_leads', (select (count(*) > 0)::text from information_schema.columns where table_schema='public' and table_name='leads' and column_name='submission_id')
  union all select 8, 'migrations', 'tabelas_wjb_ai_ou_comercial_NAO_deveriam_existir', (select count(*)::text from pg_tables where schemaname = 'public'
                                                     and (tablename like 'fiscal\_%' or tablename like 'commercial\_%' or tablename like 'payment\_%' or tablename like 'rate\_limit\_%'))

  -- 9. Storage
  union all select 9, 'storage', 'buckets', (select coalesce(string_agg(id || case when public then '(PUBLICO)' else '(privado)' end, ', ' order by id), 'nenhum') from storage.buckets)
  union all select 9, 'storage', 'arquivos_por_bucket', (select coalesce(string_agg(bucket_id || '=' || n, ', '), '0') from (select bucket_id, count(*) n from storage.objects group by 1) x)
  union all select 9, 'storage', 'tamanho_total_mb', (select coalesce(round(sum((metadata->>'size')::bigint) / 1048576.0, 1)::text, '0') from storage.objects)
  union all select 9, 'storage', 'politicas_storage_objects', (select count(*)::text from pg_policies where schemaname = 'storage' and tablename = 'objects')
)
select secao, item, valor from rows_ order by o, secao, item;
