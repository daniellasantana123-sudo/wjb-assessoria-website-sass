-- Rollback da 0028 (homologação).
drop trigger if exists fiscal_certificate_usage_immutable on public.fiscal_certificate_usage;
drop function if exists public.guard_fiscal_certificate_usage_immutable();
drop table if exists public.fiscal_certificate_usage;
