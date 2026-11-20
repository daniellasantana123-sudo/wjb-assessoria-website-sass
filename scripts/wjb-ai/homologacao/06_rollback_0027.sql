-- Rollback da 0027 (homologação). Ordem inversa da criação.
drop function if exists public.allocate_dps_number(uuid, text);
drop function if exists public.configure_dps_series(uuid, text, text, integer);
drop table if exists public.fiscal_dps_numbers;
drop table if exists public.fiscal_dps_series;
drop trigger if exists fiscal_grants_guard_revocation on public.fiscal_authorization_grants;
drop function if exists public.guard_fiscal_grant_revocation();
drop policy if exists fiscal_grants_insert_staff on public.fiscal_authorization_grants;
drop policy if exists fiscal_grants_update_staff on public.fiscal_authorization_grants;
create policy fiscal_grants_write_staff on public.fiscal_authorization_grants for all
  using (public.is_staff()) with check (public.is_staff());
grant delete on public.fiscal_authorization_grants to authenticated;
alter table public.fiscal_authorization_grants
  drop constraint if exists fiscal_grants_evidence_no_secret,
  drop constraint if exists fiscal_grants_vault_ref_shape,
  drop constraint if exists fiscal_grants_cert_dates,
  drop column if exists revoke_reason,
  drop column if exists revoked_by,
  drop column if exists revoked_at,
  drop column if exists certificate_requirements_confirmed,
  drop column if exists certificate_kind,
  drop column if exists certificate_fingerprint_sha256,
  drop column if exists certificate_valid_until,
  drop column if exists certificate_valid_from,
  drop column if exists certificate_holder_document,
  drop column if exists emission_model;
