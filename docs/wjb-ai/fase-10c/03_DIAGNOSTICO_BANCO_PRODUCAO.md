# Fase 10C - Diagnóstico do banco de produção (checklist para a WJB)

**Projeto:** `wjb-website-app`. **Este documento não executa nada.**

Nesta fase:
- não usei a chave de serviço;
- não abri o painel;
- não consultei a produção de nenhuma forma.

As consultas abaixo são **somente leitura** e devem ser rodadas por um responsável autorizado da WJB no **SQL Editor** do Supabase. Elas só contam linhas e listam metadados; não trazem nome, e-mail, CPF nem conteúdo de documentos.

## 1. O que se sabe (com data e evidência)
| Data | Evidência | Leitura |
| --- | --- | --- |
| 20/11 | painel (doc 19) | papéis internos sem senha; "No backups yet" |
| 22/11 | chave de serviço, no servidor (doc 54) | Auth 200; nenhuma tabela visível (`PGRST205`); 0 usuários no Auth |
| 26/11, manhã (Fase 10B) | só a chave pública | Auth 200; `profiles` e `tenants` respondem `[]` **sem** `PGRST205`: as tabelas voltaram a existir para a API |
| 26/11 | site | `/`, `/contato` e `/planos` com 200 |

**As tabelas voltarem a responder não prova que os dados voltaram.** Com a chave pública, a RLS esconde todas as linhas, então `[]` é exatamente o que uma tabela vazia **ou** cheia devolveria. Ainda não há evidência que separe as três hipóteses:
- o suporte restaurou o banco;
- alguém recriou as tabelas vazias;
- o esquema só voltou a ser carregado.

## 2. Checklist (somente leitura)

### 2.1 Auth: quantidade de usuários
**Authentication → Users:** anotar o total e se a conta da CEO existe. Ou:
```sql
select count(*) as usuarios,
       count(*) filter (where last_sign_in_at > now() - interval '30 days') as ativos_30d,
       min(created_at) as primeiro, max(created_at) as ultimo
from auth.users;
```

### 2.2 Tabelas e quantidade de registros
```sql
select relname as tabela, n_live_tup as linhas_estimadas
from pg_stat_user_tables where schemaname = 'public' order by relname;
```
Contagem exata das tabelas principais:
```sql
select 'profiles' t, count(*) from public.profiles union all
select 'tenants', count(*) from public.tenants union all
select 'tenant_members', count(*) from public.tenant_members union all
select 'obligations', count(*) from public.obligations union all
select 'documents', count(*) from public.documents union all
select 'leads', count(*) from public.leads union all
select 'tickets', count(*) from public.tickets union all
select 'audit_log', count(*) from public.audit_log;
```
**Referência conhecida (24/09/2026):** 1 conta, 2 empresas, 6 obrigações, 0 leads. Os leads posteriores existem nos e-mails do Resend.

### 2.3 Usuários x empresas (integridade dos relacionamentos)
```sql
select
  (select count(*) from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)) as perfis_sem_usuario,
  (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as usuarios_sem_perfil,
  (select count(*) from public.tenant_members m where not exists (select 1 from public.tenants t where t.id = m.tenant_id)) as vinculos_sem_empresa,
  (select count(*) from public.tenant_members m where not exists (select 1 from public.profiles p where p.id = m.profile_id)) as vinculos_sem_pessoa,
  (select count(*) from public.profiles where is_wjb_staff) as equipe,
  (select count(*) from public.profiles where staff_role = 'super_admin') as super_admins;
```
Todos os "sem" devem dar **0**. Mais de um `super_admin`, ou contas de teste, merecem revisão.

### 2.4 RLS ligada em todas as tabelas
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by rowsecurity, tablename;
```
Toda linha deve ter `rowsecurity = true`. Qualquer `false` é urgente.
```sql
select tablename, count(*) as politicas from pg_policies
where schemaname = 'public' group by tablename order by tablename;
```

### 2.5 Histórico de migrations
**Database → Migrations**, ou:
```sql
select version, name from supabase_migrations.schema_migrations order by version;
```
O esperado na produção é ir **até a 0023**: as 0024 a 0037 nunca foram aplicadas lá. Se a tabela não existir, as migrations foram aplicadas pelo SQL Editor (como em 2026-09). Nesse caso, conferir pelas colunas:
```sql
select
  exists (select 1 from information_schema.columns where table_name='profiles' and column_name='status') as m0016,
  exists (select 1 from information_schema.tables where table_name='omie_client_mappings') as m0017,
  exists (select 1 from information_schema.columns where table_name='obligations' and column_name='external_id') as m0020,
  exists (select 1 from information_schema.tables where table_name like 'fiscal\_%') as fiscal_nao_deveria_existir;
```

### 2.6 Backups disponíveis
**Database → Backups:**
- há backup diário ou PITR? Desde quando?
- **Billing:** qual o plano? O plano gratuito não tem backup diário acessível.

### 2.7 Storage
**Storage:**
- o bucket de documentos existe?
- quantos arquivos há nele?

### 2.8 Divergências entre homologação e produção
| Item | Homologação (`wjb-ai-homologacao`) | Produção (esperado) |
| --- | --- | --- |
| Migrations | 0001 a 0037 | 0001 a 0023 |
| Tabelas `fiscal_*`, `commercial_*`, `payment_*`, `rate_limit_*` | existem | não devem existir |
| MFA exigido no banco (0035) | sim | não |
| Usuários | 8 fictícios | conta(s) real(is) |
| Next.js | 16.4.6 (branch) | 16.3.7 (a `main` publicada) |

## 3. O que trazer de volta
Para decidir a recuperação, basta anotar:
- os números de 2.1 a 2.3;
- `true`/`false` de 2.4 e 2.5;
- as respostas de 2.6 e 2.7.

Não exportar dados nem colar resultados com e-mail, CPF ou nomes. O plano de decisão está no doc 04.
