-- Rollback da 0024. Nenhuma tabela existente é alterada pela 0024; o
-- rollback só remove o que ela criou. As linhas de audit_log gravadas pelas
-- funções permanecem (histórico).
drop function if exists public.approve_fiscal_profile(uuid, text);
drop function if exists public.revoke_fiscal_profile_approver(uuid, text);
drop function if exists public.grant_fiscal_profile_approver(uuid, uuid, text);
drop function if exists public.can_approve_fiscal_profile(uuid);
drop table if exists public.fiscal_issuance_attempts, public.fiscal_request_events,
  public.fiscal_requests, public.fiscal_profile_approvals, public.fiscal_profile_approver_grants,
  public.fiscal_authorization_grants, public.fiscal_profiles;
