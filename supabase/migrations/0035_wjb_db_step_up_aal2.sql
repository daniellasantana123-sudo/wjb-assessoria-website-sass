-- =====================================================================
-- WJB AI - Fase 10A.1 (2026-11-21). Reforço de MFA NO BANCO.
--
-- Até aqui o step-up (MFA recente) era conferido só no servidor da
-- aplicação. Quem tivesse a senha de um super admin ou contador podia chamar
-- o PostgREST direto e aprovar preço ou conceder aprovador. Agora o banco
-- exige sessão aal2 (senha + segundo fator) para as operações sensíveis:
--   - aprovar ou alterar planos e preços, desconto do combo e premissas
--     (commercial_plans, commercial_settings);
--   - registrar ou revogar autorização de emissão (fiscal_authorization_grants);
--   - conceder ou revogar aprovador, aprovar perfil fiscal e configurar a
--     série da DPS (funções SECURITY DEFINER).
-- O servidor com service role não é afetado (é autenticação de serviço,
-- protegida pelo segredo; ver doc 53).
--
-- Funções: a original vira `<nome>_impl` (sem execução para usuários) e uma
-- função de mesmo nome exige aal2 e chama a original; a lógica já testada
-- não é reescrita.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/23_rollback_0035.sql
-- =====================================================================

create function public.has_aal2()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'), '') = 'aal2'
$$;
grant execute on function public.has_aal2() to authenticated, service_role;

create function public.require_aal2()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.has_aal2() then
    raise exception 'Operação sensível: confirme a verificação em duas etapas (MFA).' using errcode = '42501';
  end if;
end;
$$;

-- Políticas RESTRITIVAS: somam-se às existentes (que já exigem o papel).
create policy commercial_plans_insert_aal2 on public.commercial_plans as restrictive for insert to authenticated with check (public.has_aal2());
create policy commercial_plans_update_aal2 on public.commercial_plans as restrictive for update to authenticated using (public.has_aal2()) with check (public.has_aal2());
create policy commercial_settings_insert_aal2 on public.commercial_settings as restrictive for insert to authenticated with check (public.has_aal2());
create policy commercial_settings_update_aal2 on public.commercial_settings as restrictive for update to authenticated using (public.has_aal2()) with check (public.has_aal2());
create policy fiscal_grants_insert_aal2 on public.fiscal_authorization_grants as restrictive for insert to authenticated with check (public.has_aal2());
create policy fiscal_grants_update_aal2 on public.fiscal_authorization_grants as restrictive for update to authenticated using (public.has_aal2()) with check (public.has_aal2());

-- Funções SECURITY DEFINER sensíveis.
alter function public.approve_fiscal_profile(uuid, text) rename to approve_fiscal_profile_impl;
revoke all on function public.approve_fiscal_profile_impl(uuid, text) from public, anon, authenticated;
create function public.approve_fiscal_profile(p_fiscal_profile_id uuid, p_justification text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_aal2();
  perform public.approve_fiscal_profile_impl(p_fiscal_profile_id, p_justification);
end;
$$;

alter function public.revoke_fiscal_profile_approver(uuid, text) rename to revoke_fiscal_profile_approver_impl;
revoke all on function public.revoke_fiscal_profile_approver_impl(uuid, text) from public, anon, authenticated;
create function public.revoke_fiscal_profile_approver(p_grant_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_aal2();
  perform public.revoke_fiscal_profile_approver_impl(p_grant_id, p_reason);
end;
$$;

alter function public.grant_fiscal_profile_approver(uuid, uuid, text) rename to grant_fiscal_profile_approver_impl;
revoke all on function public.grant_fiscal_profile_approver_impl(uuid, uuid, text) from public, anon, authenticated;
create function public.grant_fiscal_profile_approver(p_profile_id uuid, p_tenant_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.require_aal2();
  return public.grant_fiscal_profile_approver_impl(p_profile_id, p_tenant_id, p_reason);
end;
$$;

alter function public.configure_dps_series(uuid, text, text, integer) rename to configure_dps_series_impl;
revoke all on function public.configure_dps_series_impl(uuid, text, text, integer) from public, anon, authenticated;
create function public.configure_dps_series(p_tenant_id uuid, p_environment text, p_emitter_document text, p_series integer)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.require_aal2();
  return public.configure_dps_series_impl(p_tenant_id, p_environment, p_emitter_document, p_series);
end;
$$;

revoke all on function public.approve_fiscal_profile(uuid, text) from public, anon;
revoke all on function public.revoke_fiscal_profile_approver(uuid, text) from public, anon;
revoke all on function public.grant_fiscal_profile_approver(uuid, uuid, text) from public, anon;
revoke all on function public.configure_dps_series(uuid, text, text, integer) from public, anon;
grant execute on function public.approve_fiscal_profile(uuid, text) to authenticated;
grant execute on function public.revoke_fiscal_profile_approver(uuid, text) to authenticated;
grant execute on function public.grant_fiscal_profile_approver(uuid, uuid, text) to authenticated;
grant execute on function public.configure_dps_series(uuid, text, text, integer) to authenticated;
