-- =====================================================================
-- WJB AI - Fase 10C (2026-11-26). SOMENTE ADITIVA. Reforço da 0036 a
-- partir da revisão de segurança independente da própria fase:
--   M2: o comprometimento é da CHAVE, não do certificado. Um certificado
--       reemitido com o mesmo par de chaves tem outra impressão digital.
--       Agora a chave pública (SHA-256 da SubjectPublicKeyInfo) também é
--       registrada e bloqueada para sempre.
--   M1: certificado de cliente precisa ser do titular da empresa (CNPJ) e
--       nunca da WJB; a rotação só troca por certificado do mesmo titular.
--   M3: apagar um perfil (LGPD, saída de pessoa) zerava blocked_by /
--       created_by e o gatilho de imutabilidade recusava. Agora só essa
--       mudança (valor -> NULL, todo o resto igual) é aceita.
--   B2: equipe não lê o documento do titular nem a referência do cofre
--       pela API (permissão por coluna).
--   B3: avisos de vencimento também exigem MFA (aal2) para leitura.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/27_rollback_0037.sql
-- Depende de: 0036.
-- =====================================================================

-- M2: chave pública.
alter table public.fiscal_certificates
  add column spki_sha256 text check (spki_sha256 ~ '^[0-9a-f]{64}$');
-- Na homologação só há certificados fictícios apagados no fim dos testes;
-- qualquer linha antiga sem a chave não pode mais ser ativada (gatilho).

create table public.fiscal_certificate_key_blocklist (
  spki_sha256 text primary key check (spki_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('comprometido', 'revogado', 'substituido', 'bloqueado')),
  blocked_at timestamptz not null default now()
);
alter table public.fiscal_certificate_key_blocklist enable row level security;
create policy fiscal_certificate_key_blocklist_select_staff on public.fiscal_certificate_key_blocklist
  for select using (public.is_staff());
create policy fiscal_certificate_key_blocklist_select_aal2 on public.fiscal_certificate_key_blocklist
  as restrictive for select to authenticated using (public.has_aal2());
grant select on public.fiscal_certificate_key_blocklist to authenticated;
revoke insert, update, delete, truncate on public.fiscal_certificate_key_blocklist from authenticated, anon;
revoke all on public.fiscal_certificate_key_blocklist from anon;
create trigger fiscal_certificate_key_blocklist_permanent
  before update or delete on public.fiscal_certificate_key_blocklist
  for each row execute function public.guard_fiscal_certificate_blocklist_permanent();
create trigger fiscal_certificate_key_blocklist_no_truncate
  before truncate on public.fiscal_certificate_key_blocklist
  for each statement execute function public.guard_fiscal_certificate_blocklist_permanent();

-- M3 na lista por impressão digital: só "blocked_by -> NULL" passa.
create or replace function public.guard_fiscal_certificate_blocklist_permanent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Condições aninhadas: o PL/pgSQL não garante curto-circuito no AND, e
  -- blocked_by só existe na lista por impressão digital.
  if tg_op = 'UPDATE' and tg_table_name = 'fiscal_certificate_blocklist' then
    if old.blocked_by is not null and new.blocked_by is null
       and new.fingerprint_sha256 = old.fingerprint_sha256
       and new.reason = old.reason and new.blocked_at = old.blocked_at then
      return new; -- perfil apagado: o bloqueio continua, só perde o autor
    end if;
  end if;
  raise exception 'Bloqueio de certificado é permanente: não pode ser alterado nem removido.' using errcode = '42501';
end;
$$;

-- Guarda do registro: M1, M2 e M3 somados às regras da 0036.
create or replace function public.guard_fiscal_certificates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant_doc text;
begin
  if tg_op = 'DELETE' then
    if old.tenant_id is not null and not exists (select 1 from public.tenants where id = old.tenant_id) then
      return old;
    end if;
    raise exception 'Registro de certificado não é apagado: bloqueie ou substitua.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' then
      raise exception 'Certificado novo entra como pendente.' using errcode = '23514';
    end if;
    if new.spki_sha256 is null then
      raise exception 'Informe a chave pública (SHA-256 da SPKI).' using errcode = '23514';
    end if;
    if exists (select 1 from public.fiscal_certificate_blocklist b where b.fingerprint_sha256 = new.fingerprint_sha256)
       or exists (select 1 from public.fiscal_certificate_key_blocklist k where k.spki_sha256 = new.spki_sha256) then
      raise exception 'Certificado ou chave bloqueados permanentemente.' using errcode = '42501';
    end if;
    if new.role = 'cliente' then
      select regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') into v_tenant_doc from public.tenants where id = new.tenant_id;
      -- e-CNPJ do cliente: titular = CNPJ da empresa. (e-CPF fica para o servidor.)
      if length(new.holder_document) = 14 and v_tenant_doc is distinct from new.holder_document then
        raise exception 'O titular do certificado não é a empresa.' using errcode = '42501';
      end if;
    end if;
    new.activated_at := null; new.retired_at := null; new.superseded_by := null;
    return new;
  end if;
  -- UPDATE. M3: perfil apagado zera o autor; nada mais muda.
  if old.created_by is not null and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  if new.fingerprint_sha256 is distinct from old.fingerprint_sha256
     or new.spki_sha256 is distinct from old.spki_sha256
     or new.role is distinct from old.role
     or new.tenant_id is distinct from old.tenant_id
     or new.holder_document is distinct from old.holder_document
     or new.kind is distinct from old.kind
     or new.valid_from is distinct from old.valid_from
     or new.valid_until is distinct from old.valid_until
     or new.vault_reference is distinct from old.vault_reference
     or new.policy_checked_at is distinct from old.policy_checked_at
     or new.created_by is distinct from old.created_by
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
    if new.spki_sha256 is null
       or exists (select 1 from public.fiscal_certificate_blocklist b where b.fingerprint_sha256 = new.fingerprint_sha256)
       or exists (select 1 from public.fiscal_certificate_key_blocklist k where k.spki_sha256 = new.spki_sha256) then
      raise exception 'Certificado ou chave bloqueados permanentemente.' using errcode = '42501';
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

-- Retirado: impressão digital E chave entram nas listas permanentes.
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
  if new.spki_sha256 is not null then
    insert into public.fiscal_certificate_key_blocklist (spki_sha256, reason)
    values (new.spki_sha256, new.status)
    on conflict (spki_sha256) do nothing;
  end if;
  return null;
end;
$$;

-- Rotação: só para certificado do MESMO titular e com OUTRA chave.
create or replace function public.rotate_fiscal_certificate(p_new uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.fiscal_certificates%rowtype;
  v_old public.fiscal_certificates%rowtype;
begin
  select * into v_new from public.fiscal_certificates where id = p_new for update;
  if not found or v_new.status <> 'pendente' then
    raise exception 'Certificado substituto precisa estar pendente.' using errcode = '23514';
  end if;
  select * into v_old from public.fiscal_certificates
   where role = v_new.role and tenant_id is not distinct from v_new.tenant_id and status = 'ativo'
   for update;
  if found then
    if v_old.holder_document <> v_new.holder_document then
      raise exception 'O certificado novo é de outro titular.' using errcode = '42501';
    end if;
    if v_old.spki_sha256 is not distinct from v_new.spki_sha256 then
      raise exception 'O certificado novo usa a mesma chave do atual.' using errcode = '42501';
    end if;
    update public.fiscal_certificates set status = 'substituido', superseded_by = p_new where id = v_old.id;
  end if;
  update public.fiscal_certificates set status = 'ativo' where id = p_new;
  return v_old.id;
end;
$$;
revoke execute on function public.rotate_fiscal_certificate(uuid) from public, authenticated, anon;
grant execute on function public.rotate_fiscal_certificate(uuid) to service_role;

-- B2: equipe lê só o necessário (sem documento do titular nem cofre).
revoke select on public.fiscal_certificates from authenticated;
grant select (id, role, tenant_id, fingerprint_sha256, spki_sha256, kind, valid_from, valid_until,
              status, superseded_by, activated_at, retired_at, created_at)
  on public.fiscal_certificates to authenticated;

-- B3: avisos também com MFA.
create policy fiscal_certificate_expiry_notices_select_aal2 on public.fiscal_certificate_expiry_notices
  as restrictive for select to authenticated using (public.has_aal2());
