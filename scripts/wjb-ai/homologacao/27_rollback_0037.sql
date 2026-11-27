-- Rollback da 0037 (homologação): volta as funções e permissões da 0036.
-- Funções copiadas da 0036 (gerado a partir dela; não editar à mão).
create or replace function public.guard_fiscal_certificate_blocklist_permanent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Bloqueio de certificado é permanente: não pode ser alterado nem removido.' using errcode = '42501';
end;
$$;
create or replace function public.guard_fiscal_certificates()
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
create or replace function public.block_retired_fiscal_certificate()
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
create or replace function public.rotate_fiscal_certificate(p_new uuid)
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
drop policy if exists fiscal_certificate_expiry_notices_select_aal2 on public.fiscal_certificate_expiry_notices;
revoke select (id, role, tenant_id, fingerprint_sha256, spki_sha256, kind, valid_from, valid_until,
               status, superseded_by, activated_at, retired_at, created_at) on public.fiscal_certificates from authenticated;
grant select on public.fiscal_certificates to authenticated;
drop table if exists public.fiscal_certificate_key_blocklist;
alter table public.fiscal_certificates drop column if exists spki_sha256;
