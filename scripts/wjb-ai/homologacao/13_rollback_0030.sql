-- Rollback da 0030 (homologação).
drop function if exists public.has_entitlement(uuid, text);
drop table if exists public.commercial_usage_ledger;
drop table if exists public.commercial_acceptances;
drop table if exists public.commercial_subscriptions;
drop table if exists public.commercial_accounts;
drop table if exists public.commercial_settings;
drop table if exists public.commercial_plan_changes;
drop table if exists public.commercial_plans;
drop function if exists public.commercial_plan_history();
drop function if exists public.commercial_plan_version();
drop function if exists public.commercial_append_only();
