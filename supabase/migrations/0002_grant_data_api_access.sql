-- Corrige "Could not find the table 'public.X' in the schema cache" (PGRST205)
-- nas tabelas criadas por 0001_core_schema.sql: elas existiam no Postgres, mas
-- as roles da Data API (anon/authenticated/service_role) não tinham GRANT
-- nelas — a RLS já protege por linha, mas o PostgREST exige o GRANT de tabela
-- pra sequer tentar. Mesmo comportamento que o toggle "Automatically expose
-- new tables" (painel de criação do projeto) configuraria sozinho.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

notify pgrst, 'reload schema';
