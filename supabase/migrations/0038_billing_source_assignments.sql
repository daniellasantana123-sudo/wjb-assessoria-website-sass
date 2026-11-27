-- Fase 10F: uma ÚNICA origem de cobrança ativa por empresa e serviço.
--
-- Problema: a WJB pode cobrar um serviço fora da plataforma (Omie ERP, boleto
-- do banco, transferência) e, ao mesmo tempo, ligar a cobrança pela Stripe
-- para o mesmo cliente. Nada impedia as duas ao mesmo tempo (cobrança
-- duplicada). Esta tabela registra quem cobra cada serviço de cada empresa, e
-- o índice único parcial garante NO BANCO que só exista uma origem ativa.
--
-- Só tabela nova: nenhuma tabela existente é alterada. Escrita só pelo
-- servidor (service role); equipe lê tudo, cliente lê só a própria empresa.

create table public.billing_source_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Serviço cobrado: lista fechada (planos de emissão, honorários contábeis,
  -- serviço avulso identificado pelo código do catálogo).
  service_key text not null check (
    service_key in ('nfse_plano', 'honorarios_contabeis')
    or service_key ~ '^servico_avulso:[a-z0-9_]{2,60}$'
  ),
  source text not null check (source in ('stripe', 'omie', 'externo')),
  status text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  -- Referência opaca no sistema de origem (ex.: id de assinatura); nunca dado pessoal.
  external_reference text check (external_reference is null or length(external_reference) <= 120),
  note text check (note is null or length(note) <= 500),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  ended_by uuid references public.profiles (id) on delete set null,
  check ((status = 'ativa') = (ended_at is null))
);

-- A garantia: no máximo uma origem ativa por empresa e serviço.
create unique index billing_source_one_active_idx
  on public.billing_source_assignments (tenant_id, service_key)
  where status = 'ativa';
create index billing_source_tenant_idx on public.billing_source_assignments (tenant_id, started_at desc);

-- Encerrada é final: não volta a ficar ativa nem muda de origem (histórico).
create function public.guard_billing_source_history() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status = 'encerrada' then
    raise exception 'Origem de cobrança encerrada não pode ser alterada.' using errcode = '42501';
  end if;
  if new.tenant_id <> old.tenant_id or new.service_key <> old.service_key or new.source <> old.source then
    raise exception 'Empresa, serviço e origem não mudam: encerre e registre outra.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger billing_source_history_guard
  before update on public.billing_source_assignments
  for each row execute function public.guard_billing_source_history();

alter table public.billing_source_assignments enable row level security;

create policy billing_source_select on public.billing_source_assignments for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

revoke all on public.billing_source_assignments from anon, authenticated;
grant select on public.billing_source_assignments to authenticated;
grant all on public.billing_source_assignments to service_role;
