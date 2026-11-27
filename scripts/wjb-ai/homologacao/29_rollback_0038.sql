-- Rollback da 0038 (homologação): só a tabela nova e o seu gatilho.
drop table if exists public.billing_source_assignments;
drop function if exists public.guard_billing_source_history();
