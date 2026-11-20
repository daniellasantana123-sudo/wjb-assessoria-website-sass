-- =====================================================================
-- WJB AI - núcleo fiscal (F1, 2026-11-20). SOMENTE ADITIVA.
--
-- ESTADO: validada em HOMOLOGAÇÃO local (scripts/wjb-ai/homologacao),
-- NÃO APLICADA em produção. O código do módulo
-- não depende destas tabelas enquanto WJB_AI_ENABLED estiver desligado.
-- Aplicar só com aprovação (docs/wjb-ai/11-RUNBOOK-E-ROLLBACK.md tem o
-- rollback: drop das 7 tabelas e 4 funções, nada existente é alterado).
--
-- Regras de segurança:
-- - nenhuma coluna guarda senha gov.br, PFX, chave privada ou token: o
--   certificado é só uma REFERÊNCIA a cofre externo;
-- - tenant_id em todas as tabelas, RLS ligada em todas;
-- - eventos e tentativas de envio são append-only e só o servidor (service
--   role) escreve - nenhum usuário consegue forjar um "AUTORIZADA".
-- =====================================================================

create table public.fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  -- Parametrização definida e aprovada pelo contador; nunca por IA.
  municipality_ibge_code text,
  service_settings jsonb not null default '{}'::jsonb,
  max_amount_cents_without_review integer not null default 0 check (max_amount_cents_without_review >= 0),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  approval_justification text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, version)
);

-- -------------------------------------------------------------------
-- Permissão granular fiscal_profile.approve (decisão da WJB, 2026-11-20):
-- só contadores EXPRESSAMENTE autorizados, nunca todo contador. Concedida e
-- revogada por super_admin. `tenant_id` nulo = vale para todas as empresas
-- a que a equipe tem acesso; preenchido = só aquela empresa.
-- -------------------------------------------------------------------
create table public.fiscal_profile_approver_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  reason text not null check (length(trim(reason)) >= 10),
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  revoke_reason text
);

-- Histórico imutável de aprovações: quem, quando, empresa, versão, justificativa.
create table public.fiscal_profile_approvals (
  id uuid primary key default gen_random_uuid(),
  fiscal_profile_id uuid not null references public.fiscal_profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  profile_version integer not null,
  approved_by uuid not null references public.profiles (id),
  approved_at timestamptz not null default now(),
  justification text not null
);

create table public.fiscal_authorization_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('procuracao', 'certificado_proprio', 'consentimento_assistido')),
  scope text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  valid_until date not null,
  evidence_reference text,          -- onde a evidência está guardada, não o documento em si
  certificate_vault_reference text, -- referência ao cofre; NUNCA o PFX ou a senha
  registered_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.fiscal_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  document_type text not null default 'NFSE' check (document_type = 'NFSE'),
  status text not null default 'RECEBIDA' check (status in (
    'RECEBIDA','TRIAGEM','DADOS_PENDENTES','VALIDACAO_FISCAL','BLOQUEADA','REVISAO_HUMANA',
    'PRONTA_PARA_CONFIRMACAO','CONFIRMADA','AUTORIZADA_PARA_ENVIO','ENFILEIRADA','ENVIANDO',
    'RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL','REJEITADA','AUTORIZADA',
    'DOCUMENTOS_DISPONIVEIS','NOTIFICADA')),
  idempotency_key text not null,
  draft_snapshot jsonb not null,
  draft_hash text not null,
  policy_decision text check (policy_decision in ('BLOCKED','HUMAN_REVIEW','READY_FOR_CONFIRMATION')),
  policy_reasons text[] not null default '{}',
  channel text not null default 'portal' check (channel in ('portal', 'whatsapp', 'admin')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.fiscal_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

create table public.fiscal_issuance_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  environment text not null check (environment in ('mock', 'homologacao', 'producao')),
  idempotency_key text not null,
  outcome text not null check (outcome in ('AUTORIZADA', 'REJEITADA', 'RESULTADO_INDETERMINADO')),
  official_reference text,
  rejection_code text,
  simulated boolean not null,
  created_at timestamptz not null default now()
);

create index fiscal_profiles_tenant_idx on public.fiscal_profiles (tenant_id);
-- No máximo um perfil aprovado vigente por empresa.
create unique index fiscal_profiles_one_approved on public.fiscal_profiles (tenant_id) where status = 'approved';
create index fiscal_approver_grants_profile_idx on public.fiscal_profile_approver_grants (profile_id) where revoked_at is null;
create index fiscal_profile_approvals_tenant_idx on public.fiscal_profile_approvals (tenant_id, approved_at desc);
create index fiscal_grants_tenant_idx on public.fiscal_authorization_grants (tenant_id, status);
create index fiscal_requests_tenant_status_idx on public.fiscal_requests (tenant_id, status, created_at desc);
create index fiscal_events_request_idx on public.fiscal_request_events (request_id, created_at);
create index fiscal_attempts_request_idx on public.fiscal_issuance_attempts (request_id);
-- Uma única tentativa AUTORIZADA por pedido, garantido no banco.
create unique index fiscal_attempts_one_authorized
  on public.fiscal_issuance_attempts (request_id) where outcome = 'AUTORIZADA';

alter table public.fiscal_profiles enable row level security;
alter table public.fiscal_profile_approver_grants enable row level security;
alter table public.fiscal_profile_approvals enable row level security;
alter table public.fiscal_authorization_grants enable row level security;
alter table public.fiscal_requests enable row level security;
alter table public.fiscal_request_events enable row level security;
alter table public.fiscal_issuance_attempts enable row level security;

-- Leitura: equipe ou membro ativo da empresa (my_tenant_ids já filtra status).
create policy fiscal_profiles_select on public.fiscal_profiles for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
-- Equipe cria e edita só RASCUNHOS. Aprovar ou arquivar o vigente é só pela
-- função approve_fiscal_profile(), que confere a permissão granular.
create policy fiscal_profiles_insert_staff on public.fiscal_profiles for insert
  with check (public.is_staff() and status = 'draft' and approved_by is null and approved_at is null);
create policy fiscal_profiles_update_staff_draft on public.fiscal_profiles for update
  using (public.is_staff() and status = 'draft')
  with check (public.is_staff() and status = 'draft' and approved_by is null and approved_at is null);

-- Concessões e histórico de aprovação: leitura da equipe; escrita só pelas
-- funções abaixo (sem policy de escrita = negado).
create policy fiscal_approver_grants_select_staff on public.fiscal_profile_approver_grants for select
  using (public.is_staff());
create policy fiscal_profile_approvals_select on public.fiscal_profile_approvals for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy fiscal_grants_select on public.fiscal_authorization_grants for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_grants_write_staff on public.fiscal_authorization_grants for all
  using (public.is_staff()) with check (public.is_staff());

create policy fiscal_requests_select on public.fiscal_requests for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
-- Cliente só cria pedido na própria empresa, em nome próprio, no estado inicial.
create policy fiscal_requests_insert_member on public.fiscal_requests for insert
  with check (
    tenant_id in (select public.my_tenant_ids())
    and created_by = auth.uid()
    and status = 'RECEBIDA'
  );
-- Equipe move o pedido só até AUTORIZADA_PARA_ENVIO. Os estados de
-- transmissão e de resultado oficial são exclusivos do servidor (service
-- role): ninguém consegue forjar "AUTORIZADA" pela API do banco.
create policy fiscal_requests_update_staff on public.fiscal_requests for update
  using (
    public.is_staff()
    and status not in ('ENFILEIRADA','ENVIANDO','RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL',
                       'REJEITADA','AUTORIZADA','DOCUMENTOS_DISPONIVEIS','NOTIFICADA')
  )
  with check (
    public.is_staff()
    and status not in ('ENFILEIRADA','ENVIANDO','RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL',
                       'REJEITADA','AUTORIZADA','DOCUMENTOS_DISPONIVEIS','NOTIFICADA')
  );

-- Eventos e tentativas: só leitura para usuários; escrita apenas pelo
-- servidor com service role (sem policy de insert = negado para o resto).
create policy fiscal_events_select on public.fiscal_request_events for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_attempts_select on public.fiscal_issuance_attempts for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

grant select, insert, update on public.fiscal_requests to authenticated;
grant select on public.fiscal_request_events, public.fiscal_issuance_attempts to authenticated;
grant select, insert, update on public.fiscal_profiles, public.fiscal_authorization_grants to authenticated;
grant select on public.fiscal_profile_approver_grants, public.fiscal_profile_approvals to authenticated;

-- ===================================================================
-- Funções da permissão fiscal_profile.approve (SECURITY DEFINER, mesmo
-- padrão de is_staff()). Todas gravam em audit_log.
-- ===================================================================

create function public.can_approve_fiscal_profile(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.fiscal_profile_approver_grants g on g.profile_id = p.id
    join public.tenants t on t.id = check_tenant_id
    where p.id = auth.uid()
      and p.is_wjb_staff = true
      and p.staff_role = 'contador'
      and p.status = 'active'
      and t.status = 'active'
      and g.revoked_at is null
      and (g.tenant_id is null or g.tenant_id = check_tenant_id)
  );
$$;

create function public.grant_fiscal_profile_approver(
  p_profile_id uuid, p_tenant_id uuid, p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Somente super_admin concede a permissão fiscal_profile.approve.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and is_wjb_staff and staff_role = 'contador' and status = 'active'
  ) then
    raise exception 'A permissão só pode ser concedida a um contador ativo.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.fiscal_profile_approver_grants
    where profile_id = p_profile_id and revoked_at is null
      and tenant_id is not distinct from p_tenant_id
  ) then
    raise exception 'Já existe uma concessão ativa igual.' using errcode = '23505';
  end if;

  insert into public.fiscal_profile_approver_grants (profile_id, tenant_id, reason, granted_by)
  values (p_profile_id, p_tenant_id, p_reason, auth.uid())
  returning id into v_id;

  insert into public.audit_log (actor_id, tenant_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_tenant_id, 'fiscal.approver_granted', 'fiscal_profile_approver_grant', v_id::text,
          jsonb_build_object('profile_id', p_profile_id, 'reason', p_reason));
  return v_id;
end;
$$;

create function public.revoke_fiscal_profile_approver(p_grant_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.fiscal_profile_approver_grants;
begin
  if not public.is_super_admin() then
    raise exception 'Somente super_admin revoga a permissão fiscal_profile.approve.' using errcode = '42501';
  end if;
  update public.fiscal_profile_approver_grants
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
   where id = p_grant_id and revoked_at is null
  returning * into v_grant;
  if v_grant.id is null then
    raise exception 'Concessão não encontrada ou já revogada.' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, tenant_id, action, entity, entity_id, metadata)
  values (auth.uid(), v_grant.tenant_id, 'fiscal.approver_revoked', 'fiscal_profile_approver_grant', p_grant_id::text,
          jsonb_build_object('profile_id', v_grant.profile_id, 'reason', p_reason));
end;
$$;

create function public.approve_fiscal_profile(p_fiscal_profile_id uuid, p_justification text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.fiscal_profiles;
begin
  select * into v_profile from public.fiscal_profiles where id = p_fiscal_profile_id for update;
  if v_profile.id is null then
    raise exception 'Perfil fiscal não encontrado.' using errcode = '22023';
  end if;
  if not public.can_approve_fiscal_profile(v_profile.tenant_id) then
    raise exception 'Sem a permissão fiscal_profile.approve para esta empresa.' using errcode = '42501';
  end if;
  if v_profile.status <> 'draft' then
    raise exception 'Só um rascunho pode ser aprovado.' using errcode = '22023';
  end if;
  if p_justification is null or length(trim(p_justification)) < 10 then
    raise exception 'A justificativa da aprovação é obrigatória (mínimo 10 caracteres).' using errcode = '22023';
  end if;

  -- O perfil vigente anterior é arquivado; nunca editado.
  update public.fiscal_profiles set status = 'archived'
   where tenant_id = v_profile.tenant_id and status = 'approved';

  update public.fiscal_profiles
     set status = 'approved', approved_by = auth.uid(), approved_at = now(),
         approval_justification = p_justification
   where id = p_fiscal_profile_id;

  insert into public.fiscal_profile_approvals
    (fiscal_profile_id, tenant_id, profile_version, approved_by, justification)
  values (v_profile.id, v_profile.tenant_id, v_profile.version, auth.uid(), p_justification);

  insert into public.audit_log (actor_id, tenant_id, action, entity, entity_id, metadata)
  values (auth.uid(), v_profile.tenant_id, 'fiscal.profile_approved', 'fiscal_profile', v_profile.id::text,
          jsonb_build_object('version', v_profile.version, 'justification', p_justification));
end;
$$;

revoke all on function public.grant_fiscal_profile_approver(uuid, uuid, text) from public, anon;
revoke all on function public.revoke_fiscal_profile_approver(uuid, text) from public, anon;
revoke all on function public.approve_fiscal_profile(uuid, text) from public, anon;
grant execute on function public.can_approve_fiscal_profile(uuid) to authenticated;
grant execute on function public.grant_fiscal_profile_approver(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_fiscal_profile_approver(uuid, text) to authenticated;
grant execute on function public.approve_fiscal_profile(uuid, text) to authenticated;
