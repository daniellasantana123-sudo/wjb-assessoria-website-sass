-- Rollback da 0036 (homologação). A lista de bloqueio é permanente: o
-- rollback só existe para bancos de teste e remove os gatilhos antes.
drop table if exists public.fiscal_certificate_expiry_notices;
drop function if exists public.block_fiscal_certificate(text, text);
drop function if exists public.rotate_fiscal_certificate(uuid);
drop trigger if exists fiscal_certificate_blocklist_retire on public.fiscal_certificate_blocklist;
drop function if exists public.retire_blocked_fiscal_certificate();
drop trigger if exists fiscal_certificates_block_retired on public.fiscal_certificates;
drop function if exists public.block_retired_fiscal_certificate();
drop trigger if exists fiscal_certificates_guard on public.fiscal_certificates;
drop function if exists public.guard_fiscal_certificates();
drop table if exists public.fiscal_certificates;
drop trigger if exists fiscal_certificate_blocklist_permanent on public.fiscal_certificate_blocklist;
drop trigger if exists fiscal_certificate_blocklist_no_truncate on public.fiscal_certificate_blocklist;
drop function if exists public.guard_fiscal_certificate_blocklist_permanent();
drop table if exists public.fiscal_certificate_blocklist;
