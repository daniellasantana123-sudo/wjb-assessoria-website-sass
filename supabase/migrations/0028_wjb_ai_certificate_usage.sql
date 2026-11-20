-- =====================================================================
-- WJB AI - Fase 6 (2026-11-20). SOMENTE ADITIVA.
-- Trilha de uso do certificado digital: cada tentativa de assinar ou de
-- abrir conexão mTLS fica registrada (permitida, negada ou com erro).
-- Nunca guarda chave, senha ou o certificado: só a impressão digital
-- pública (SHA-256) e o motivo.
-- Imutável: nem a equipe nem o servidor alteram ou apagam registros.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/09_rollback_0028.sql
-- Depende de: 0024 (fiscal_requests, fiscal_authorization_grants),
--   0021 (is_staff).
-- =====================================================================
create table public.fiscal_certificate_usage (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid references public.fiscal_requests (id) on delete set null,
  grant_id uuid references public.fiscal_authorization_grants (id) on delete set null,
  emission_model text check (emission_model in ('wjb_procuracao', 'certificado_cliente')),
  certificate_fingerprint text check (certificate_fingerprint ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('assinatura', 'mtls')),
  environment text not null check (environment in ('simulado', 'producao_restrita', 'producao')),
  outcome text not null check (outcome in ('ok', 'negado', 'erro')),
  reason text check (reason is null or (length(reason) <= 300
                     and reason !~* '-----BEGIN|PRIVATE KEY|senha|password')),
  used_at timestamptz not null default now()
);
create index fiscal_certificate_usage_tenant_idx on public.fiscal_certificate_usage (tenant_id, used_at desc);
create index fiscal_certificate_usage_outcome_idx on public.fiscal_certificate_usage (outcome, used_at desc);

alter table public.fiscal_certificate_usage enable row level security;
-- Só a equipe lê. Escrita só pelo servidor (service role); sem policy de escrita.
create policy fiscal_certificate_usage_select_staff on public.fiscal_certificate_usage for select
  using (public.is_staff());
grant select on public.fiscal_certificate_usage to authenticated;
revoke insert, update, delete on public.fiscal_certificate_usage from authenticated, anon;

create function public.guard_fiscal_certificate_usage_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Exceção única: a cascata ao apagar a empresa (LGPD/encerramento).
  if tg_op = 'DELETE' and not exists (select 1 from public.tenants where id = old.tenant_id) then
    return old;
  end if;
  raise exception 'A trilha de uso do certificado é imutável.' using errcode = '42501';
end;
$$;

create trigger fiscal_certificate_usage_immutable
  before update or delete on public.fiscal_certificate_usage
  for each row execute function public.guard_fiscal_certificate_usage_immutable();
