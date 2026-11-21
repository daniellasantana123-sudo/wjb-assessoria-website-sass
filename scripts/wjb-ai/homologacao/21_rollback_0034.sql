-- Rollback da 0034 (homologação).
drop index if exists public.commercial_subscriptions_tenant_idx;
drop index if exists public.commercial_acceptances_tenant_idx;
drop index if exists public.fiscal_request_versions_tenant_idx;
drop index if exists public.fiscal_issuance_attempts_tenant_idx;
drop index if exists public.fiscal_request_events_tenant_idx;
drop function if exists public.rate_limit_hit(text, integer, integer);
drop table if exists public.rate_limit_buckets;
