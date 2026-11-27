-- =====================================================================
-- WJB AI - Fase 10C (2026-11-26). SOMENTE ADITIVA.
-- Ciclo de vida do certificado digital (só METADADOS públicos):
--   - fiscal_certificate_blocklist: bloqueio PERMANENTE por impressão
--     digital SHA-256. Ninguém altera nem apaga (nem o servidor, nem o
--     SQL Editor sem desligar o gatilho de propósito).
--   - fiscal_certificates: registro dos certificados (WJB e clientes), com
--     um único ATIVO por titular/papel. Rotação troca o ativo e bloqueia o
--     anterior para sempre; certificado bloqueado nunca volta a ser ativo.
--   - fiscal_certificate_expiry_notices: avisos de vencimento (90/60/30/15/7
--     dias e vencido) enviados uma única vez por certificado e marco.
-- Nunca guarda o arquivo, a chave privada, a senha nem o certificado
-- público (que traz CPF do responsável): o material fica no cofre
-- referenciado por vault_reference.
-- A data de emissão NÃO é prova de segurança: aceitar um certificado
-- continua exigindo a política completa da aplicação (cadeia ICP-Brasil,
-- revogação, algoritmo, titular) antes do registro e a cada uso.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/25_rollback_0036.sql
-- Depende de: 0001 (tenants, profiles), 0021 (is_staff, is_super_admin),
--   0035 (has_aal2, require_aal2).
-- =====================================================================

create table public.fiscal_certificate_blocklist (
  fingerprint_sha256 text primary key check (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('comprometido', 'revogado', 'substituido', 'bloqueado')),
  blocked_at timestamptz not null default now(),
  blocked_by uuid references public.profiles (id) on delete set null
);
alter table public.fiscal_certificate_blocklist enable row level security;
create policy fiscal_certificate_blocklist_select_staff on public.fiscal_certificate_blocklist
  for select using (public.is_staff());
create policy fiscal_certificate_blocklist_select_aal2 on public.fiscal_certificate_blocklist
  as restrictive for select to authenticated using (public.has_aal2());
grant select on public.fiscal_certificate_blocklist to authenticated;
revoke insert, update, delete, truncate on public.fiscal_certificate_blocklist from authenticated, anon;
revoke all on public.fiscal_certificate_blocklist from anon;

create function public.guard_fiscal_certificate_blocklist_permanent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Bloqueio de certificado é permanente: não pode ser alterado nem removido.' using errcode = '42501';
end;
$$;
create trigger fiscal_certificate_blocklist_permanent
  before update or delete on public.fiscal_certificate_blocklist
  for each row execute function public.guard_fiscal_certificate_blocklist_permanent();
create trigger fiscal_certificate_blocklist_no_truncate
  before truncate on public.fiscal_certificate_blocklist
  for each statement execute function public.guard_fiscal_certificate_blocklist_permanent();

create table public.fiscal_certificates (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('wjb', 'cliente')),
  tenant_id uuid references public.tenants (id) on delete cascade,
  fingerprint_sha256 text not null unique check (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  holder_document text not null check (holder_document ~ '^(\d{11}|\d{14})$'),
  kind text not null check (kind in ('A1', 'A3')),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  vault_reference text not null check (vault_reference ~ '^vault://[A-Za-z0-9._/-]{3,200}$'),
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'substituido', 'bloqueado')),
  -- Versão da política que aprovou o registro (auditoria; nunca dado pessoal).
  policy_checked_at timestamptz not null,
  superseded_by uuid references public.fiscal_certificates (id),
  activated_at timestamptz,
  retired_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fiscal_certificates_role_tenant check (
    (role = 'wjb' and tenant_id is null) or (role = 'cliente' and tenant_id is not null)),
  constraint fiscal_certificates_validity check (valid_until > valid_from)
);
create unique index fiscal_certificates_one_active
  on public.fiscal_certificates (role, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'ativo';
create index fiscal_certificates_expiry_idx on public.fiscal_certificates (status, valid_until);

alter table public.fiscal_certificates enable row level security;
-- Só a equipe lê (com MFA). Escrita só pelo servidor (service role), que
-- confere permissão, MFA recente e a política do certificado antes.
create policy fiscal_certificates_select_staff on public.fiscal_certificates
  for select using (public.is_staff());
create policy fiscal_certificates_select_aal2 on public.fiscal_certificates
  as restrictive for select to authenticated using (public.has_aal2());
grant select on public.fiscal_certificates to authenticated;
revoke insert, update, delete, truncate on public.fiscal_certificates from authenticated, anon;
revoke all on public.fiscal_certificates from anon;

create function public.guard_fiscal_certificates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Exceção única: cascata ao apagar a empresa (LGPD/encerramento).
    if old.tenant_id is not null and not exists (select 1 from public.tenants where id = old.tenant_id) then
      return old;
    end if;
    raise exception 'Registro de certificado não é apagado: bloqueie ou substitua.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' then
      raise exception 'Certificado novo entra como pendente.' using errcode = '23514';
    end if;
    if exists (select 1 from public.fiscal_certificate_blocklist b where b.fingerprint_sha256 = new.fingerprint_sha256) then
      raise exception 'Certificado bloqueado permanentemente.' using errcode = '42501';
    end if;
    new.activated_at := null; new.retired_at := null; new.superseded_by := null;
    return new;
  end if;
  -- UPDATE: identidade imutável.
  if new.fingerprint_sha256 is distinct from old.fingerprint_sha256
     or new.role is distinct from old.role
     or new.tenant_id is distinct from old.tenant_id
     or new.holder_document is distinct from old.holder_document
     or new.kind is distinct from old.kind
     or new.valid_from is distinct from old.valid_from
     or new.valid_until is distinct from old.valid_until
     or new.vault_reference is distinct from old.vault_reference
     or new.policy_checked_at is distinct from old.policy_checked_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Dados do certificado são imutáveis: registre um novo.' using errcode = '42501';
  end if;
  if old.status in ('substituido', 'bloqueado') then
    raise exception 'Certificado retirado não volta a ser usado.' using errcode = '42501';
  end if;
  if new.status = old.status then
    if new.superseded_by is distinct from old.superseded_by
       or new.activated_at is distinct from old.activated_at
       or new.retired_at is distinct from old.retired_at then
      raise exception 'Campos de ciclo de vida só mudam junto com o status.' using errcode = '42501';
    end if;
    return new;
  end if;
  if not ((old.status = 'pendente' and new.status in ('ativo', 'bloqueado'))
       or (old.status = 'ativo' and new.status in ('substituido', 'bloqueado'))) then
    raise exception 'Transição de status inválida: % -> %.', old.status, new.status using errcode = '23514';
  end if;
  if new.status = 'ativo' then
    if exists (select 1 from public.fiscal_certificate_blocklist b where b.fingerprint_sha256 = new.fingerprint_sha256) then
      raise exception 'Certificado bloqueado permanentemente.' using errcode = '42501';
    end if;
    if new.valid_until <= now() then
      raise exception 'Certificado vencido não é ativado.' using errcode = '23514';
    end if;
    new.activated_at := now();
  else
    if new.status = 'substituido' and new.superseded_by is null then
      raise exception 'Substituição exige o certificado substituto.' using errcode = '23514';
    end if;
    new.retired_at := now();
  end if;
  return new;
end;
$$;
create trigger fiscal_certificates_guard
  before insert or update or delete on public.fiscal_certificates
  for each row execute function public.guard_fiscal_certificates();

-- Certificado retirado (substituído ou bloqueado) entra na lista permanente
-- DEPOIS da gravação: não pode voltar nem ser cadastrado de novo.
create function public.block_retired_fiscal_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fiscal_certificate_blocklist (fingerprint_sha256, reason, blocked_by)
  values (new.fingerprint_sha256, new.status, null)
  on conflict (fingerprint_sha256) do nothing;
  return null;
end;
$$;
create trigger fiscal_certificates_block_retired
  after update of status on public.fiscal_certificates
  for each row when (new.status in ('substituido', 'bloqueado') and old.status is distinct from new.status)
  execute function public.block_retired_fiscal_certificate();
revoke execute on function public.block_retired_fiscal_certificate() from public, authenticated, anon;

-- Bloquear uma impressão digital também retira o certificado registrado.
create function public.retire_blocked_fiscal_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fiscal_certificates set status = 'bloqueado'
   where fingerprint_sha256 = new.fingerprint_sha256 and status in ('pendente', 'ativo');
  return new;
end;
$$;
create trigger fiscal_certificate_blocklist_retire
  after insert on public.fiscal_certificate_blocklist
  for each row execute function public.retire_blocked_fiscal_certificate();
revoke execute on function public.retire_blocked_fiscal_certificate() from public, authenticated, anon;

-- Rotação atômica (só servidor). O servidor confere antes: permissão,
-- MFA recente e a política do certificado novo (cadeia, revogação, titular).
create function public.rotate_fiscal_certificate(p_new uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.fiscal_certificates%rowtype;
  v_old uuid;
begin
  select * into v_new from public.fiscal_certificates where id = p_new for update;
  if not found or v_new.status <> 'pendente' then
    raise exception 'Certificado substituto precisa estar pendente.' using errcode = '23514';
  end if;
  select id into v_old from public.fiscal_certificates
   where role = v_new.role and tenant_id is not distinct from v_new.tenant_id and status = 'ativo'
   for update;
  if v_old is not null then
    update public.fiscal_certificates set status = 'substituido', superseded_by = p_new where id = v_old;
  end if;
  update public.fiscal_certificates set status = 'ativo' where id = p_new;
  return v_old;
end;
$$;
revoke execute on function public.rotate_fiscal_certificate(uuid) from public, authenticated, anon;
grant execute on function public.rotate_fiscal_certificate(uuid) to service_role;

-- Bloqueio manual por super admin com MFA (também pelo servidor).
create function public.block_fiscal_certificate(p_fingerprint text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := lower(regexp_replace(coalesce(p_fingerprint, ''), '[:\s]', '', 'g'));
begin
  if auth.uid() is not null then
    perform public.require_aal2();
    if not public.is_super_admin() then
      raise exception 'Só super admin bloqueia certificado.' using errcode = '42501';
    end if;
  end if;
  if v_fp !~ '^[0-9a-f]{64}$' then
    raise exception 'Impressão digital SHA-256 inválida.' using errcode = '22023';
  end if;
  if p_reason not in ('comprometido', 'revogado', 'bloqueado') then
    raise exception 'Motivo inválido.' using errcode = '22023';
  end if;
  insert into public.fiscal_certificate_blocklist (fingerprint_sha256, reason, blocked_by)
  values (v_fp, p_reason, auth.uid())
  on conflict (fingerprint_sha256) do nothing;
end;
$$;
revoke execute on function public.block_fiscal_certificate(text, text) from public, anon;
grant execute on function public.block_fiscal_certificate(text, text) to authenticated, service_role;

create table public.fiscal_certificate_expiry_notices (
  certificate_id uuid not null references public.fiscal_certificates (id) on delete cascade,
  milestone integer not null check (milestone in (90, 60, 30, 15, 7, 0)),
  notified_at timestamptz not null default now(),
  primary key (certificate_id, milestone)
);
alter table public.fiscal_certificate_expiry_notices enable row level security;
create policy fiscal_certificate_expiry_notices_select_staff on public.fiscal_certificate_expiry_notices
  for select using (public.is_staff());
grant select on public.fiscal_certificate_expiry_notices to authenticated;
revoke insert, update, delete, truncate on public.fiscal_certificate_expiry_notices from authenticated, anon;
revoke all on public.fiscal_certificate_expiry_notices from anon;
