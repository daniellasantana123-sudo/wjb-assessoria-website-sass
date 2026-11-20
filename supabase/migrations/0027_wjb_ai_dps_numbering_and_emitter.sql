-- =====================================================================
-- WJB AI - Fase 5 (2026-11-20). SOMENTE ADITIVA.
--   1. Autorização de emissão nos dois modelos aprovados pela WJB:
--      A = certificado e-CNPJ da WJB + procuração eletrônica do cliente;
--      B = certificado digital do próprio cliente.
--      Guarda só METADADOS do certificado (titular, validade, impressão
--      digital) e a referência ao cofre. Nunca o PFX, a chave ou a senha.
--   2. Revogação com histórico (quem, quando, motivo); revogada não volta.
--   3. Série e numeração persistentes da DPS: número FIXO por pedido
--      (regra E0014) e sem colisão sob concorrência.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/06_rollback_0027.sql
-- Depende de: 0024 (fiscal_requests, fiscal_authorization_grants,
--   can_approve_fiscal_profile), 0021 (is_staff/is_super_admin com status).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Autorização de emissão
-- ---------------------------------------------------------------------
alter table public.fiscal_authorization_grants
  add column emission_model text
    check (emission_model in ('wjb_procuracao', 'certificado_cliente')),
  add column certificate_holder_document text
    check (certificate_holder_document ~ '^(\d{11}|\d{14})$'),
  add column certificate_valid_from date,
  add column certificate_valid_until date,
  add column certificate_fingerprint_sha256 text
    check (certificate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  add column certificate_kind text check (certificate_kind in ('A1', 'A3')),
  -- A equipe confirmou os requisitos da FAQ 17.1/17.2 (ICP-Brasil v3, uso de
  -- Assinatura Digital + Não Recusa, Autenticação de Cliente, não é AC).
  -- Com o cofre, isto passa a vir da leitura automática do certificado.
  add column certificate_requirements_confirmed boolean not null default false,
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles (id),
  add column revoke_reason text,
  add constraint fiscal_grants_cert_dates
    check (certificate_valid_from is null or certificate_valid_until is null
           or certificate_valid_until > certificate_valid_from),
  -- Referência ao cofre tem forma fixa: impede colar PEM/PFX/senha no campo.
  -- NOT VALID: só vale para linhas novas ou alteradas.
  add constraint fiscal_grants_vault_ref_shape
    check (certificate_vault_reference is null
           or certificate_vault_reference ~ '^vault://[A-Za-z0-9._/-]{3,200}$') not valid,
  add constraint fiscal_grants_evidence_no_secret
    check (evidence_reference is null
           or (length(evidence_reference) <= 300
               and evidence_reference !~* '-----BEGIN|PRIVATE KEY|senha|password')) not valid;

-- Achado na homologação da 0027: a policy "for all" da 0024 somada ao DELETE
-- que o Supabase concede por padrão deixava a equipe APAGAR uma autorização
-- (e o histórico dela). Autorização não se apaga: revoga-se, com motivo.
drop policy fiscal_grants_write_staff on public.fiscal_authorization_grants;
create policy fiscal_grants_insert_staff on public.fiscal_authorization_grants for insert
  with check (public.is_staff() and revoked_at is null);
create policy fiscal_grants_update_staff on public.fiscal_authorization_grants for update
  using (public.is_staff()) with check (public.is_staff());
revoke delete on public.fiscal_authorization_grants from authenticated, anon;

-- Revogada é definitiva; status acompanha a revogação.
create function public.guard_fiscal_grant_revocation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.revoked_at is not null then
    raise exception 'Autorização revogada não pode ser alterada.' using errcode = '42501';
  end if;
  if new.revoked_at is not null then
    if new.revoke_reason is null or length(trim(new.revoke_reason)) < 10 then
      raise exception 'Informe o motivo da revogação (mínimo 10 caracteres).' using errcode = '22023';
    end if;
    new.status := 'revoked';
  elsif new.status = 'revoked' then
    raise exception 'Use a revogação (com motivo) para revogar.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger fiscal_grants_guard_revocation
  before update on public.fiscal_authorization_grants
  for each row execute function public.guard_fiscal_grant_revocation();

-- ---------------------------------------------------------------------
-- 2. Série e numeração da DPS
-- ---------------------------------------------------------------------
create table public.fiscal_dps_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  environment text not null check (environment in ('simulado', 'producao_restrita', 'producao')),
  emitter_document text not null check (emitter_document ~ '^(\d{11}|\d{14})$'),
  -- FAQ NFS-e v1.4 (18/11/2026), 18.1/18.2: emissão por API usa a faixa
  -- 00001-49999; fora dela a SEFIN rejeita com E0010.
  series integer not null check (series between 1 and 49999),
  last_number bigint not null default 0 check (last_number between 0 and 999999999999999),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- A mesma série do mesmo emitente nunca é configurada duas vezes.
  unique (environment, emitter_document, series)
);
create unique index fiscal_dps_series_one_active
  on public.fiscal_dps_series (tenant_id, environment) where active;

create table public.fiscal_dps_numbers (
  request_id uuid primary key references public.fiscal_requests (id) on delete restrict,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  series_id uuid not null references public.fiscal_dps_series (id) on delete restrict,
  environment text not null,
  emitter_document text not null,
  series integer not null,
  number bigint not null check (number >= 1),
  allocated_at timestamptz not null default now(),
  -- Garantia final no banco: o mesmo número nunca vai para dois pedidos.
  unique (environment, emitter_document, series, number)
);
create index fiscal_dps_numbers_tenant_idx on public.fiscal_dps_numbers (tenant_id, allocated_at desc);

alter table public.fiscal_dps_series enable row level security;
alter table public.fiscal_dps_numbers enable row level security;

create policy fiscal_dps_series_select on public.fiscal_dps_series for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_dps_numbers_select on public.fiscal_dps_numbers for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
grant select on public.fiscal_dps_series, public.fiscal_dps_numbers to authenticated;

-- Configurar série: contador com fiscal_profile.approve para a empresa ou super_admin.
create function public.configure_dps_series(
  p_tenant_id uuid, p_environment text, p_emitter_document text, p_series integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.is_super_admin() or public.can_approve_fiscal_profile(p_tenant_id)) then
    raise exception 'Sem permissão para configurar a série da DPS desta empresa.' using errcode = '42501';
  end if;
  if p_environment not in ('simulado', 'producao_restrita') then
    -- Produção só depois de autorização específica da WJB (fora desta fase).
    raise exception 'Ambiente não liberado para configuração nesta fase.' using errcode = '42501';
  end if;
  update public.fiscal_dps_series set active = false
   where tenant_id = p_tenant_id and environment = p_environment and active;
  insert into public.fiscal_dps_series (tenant_id, environment, emitter_document, series, created_by)
  values (p_tenant_id, p_environment, p_emitter_document, p_series, auth.uid())
  returning id into v_id;
  insert into public.audit_log (actor_id, tenant_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_tenant_id, 'fiscal.dps_series_configured', 'fiscal_dps_series', v_id::text,
          jsonb_build_object('environment', p_environment, 'series', p_series));
  return v_id;
end;
$$;

-- Aloca (ou devolve) o número da DPS de um pedido. Idempotente por pedido:
-- reenvio depois de timeout recebe o MESMO número. A trava na linha da série
-- serializa pedidos concorrentes da mesma empresa.
create function public.allocate_dps_number(p_request_id uuid, p_environment text)
returns table (series integer, number bigint, emitter_document text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.fiscal_requests;
  v_s public.fiscal_dps_series;
  v_n public.fiscal_dps_numbers;
begin
  select * into v_n from public.fiscal_dps_numbers n where n.request_id = p_request_id;
  if found then
    if v_n.environment <> p_environment then
      raise exception 'Pedido já numerado em outro ambiente.' using errcode = '22023';
    end if;
    return query select v_n.series, v_n.number, v_n.emitter_document;
    return;
  end if;

  select * into v_req from public.fiscal_requests r where r.id = p_request_id;
  if not found then
    raise exception 'Pedido inexistente.' using errcode = 'P0002';
  end if;
  if v_req.status not in ('AUTORIZADA_PARA_ENVIO', 'ENFILEIRADA', 'ENVIANDO') then
    raise exception 'Pedido não autorizado para envio.' using errcode = '42501';
  end if;

  select * into v_s from public.fiscal_dps_series s
   where s.tenant_id = v_req.tenant_id and s.environment = p_environment and s.active
   for update;
  if not found then
    raise exception 'Série da DPS não configurada para esta empresa.' using errcode = 'P0002';
  end if;

  -- Rechecagem depois da trava: outra transação pode ter numerado este pedido.
  select * into v_n from public.fiscal_dps_numbers n where n.request_id = p_request_id;
  if found then
    return query select v_n.series, v_n.number, v_n.emitter_document;
    return;
  end if;

  update public.fiscal_dps_series s set last_number = s.last_number + 1
   where s.id = v_s.id returning * into v_s;
  insert into public.fiscal_dps_numbers
    (request_id, tenant_id, series_id, environment, emitter_document, series, number)
  values (p_request_id, v_req.tenant_id, v_s.id, p_environment, v_s.emitter_document, v_s.series, v_s.last_number);
  return query select v_s.series, v_s.last_number, v_s.emitter_document;
end;
$$;

revoke all on function public.allocate_dps_number(uuid, text) from public, anon, authenticated;
grant execute on function public.allocate_dps_number(uuid, text) to service_role;
revoke all on function public.configure_dps_series(uuid, text, text, integer) from public, anon;
grant execute on function public.configure_dps_series(uuid, text, text, integer) to authenticated;
