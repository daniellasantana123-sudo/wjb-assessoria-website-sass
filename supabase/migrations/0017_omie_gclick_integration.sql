-- Fase 4 do wjb-saas-mvp (2026-09-20) — integração Omie.G-Click. Reverte a
-- decisão de produto de 2026-09-16 ("nenhuma integração de ERP/fiscal
-- externo") por instrução explícita do usuário nesta fase — ver
-- `docs/product/roadmap.md` e `artifacts/wjb-saas-mvp/fase-4/decisions.md`.
--
-- Mapping por organization (nunca direto ao user, seção do prompt mestre):
-- 1 linha por tenant, staff mantém manualmente (nenhuma API de descoberta
-- automática de cliente existe) até o adapter real sincronizar. O client
-- da WJB no Omie/G-Click é UM SÓ (app_key/app_secret globais, guardados só
-- em variável de ambiente do servidor) — o que varia por tenant é o
-- identificador do cliente NAQUELE sistema externo, não uma credencial.
--
-- Mesmo padrão de enum de status já usado no projeto (obligation_status,
-- ticket_status, account_status): create type, não text check.

create type public.omie_integration_status as enum (
  'not_connected',
  'pending',
  'connected',
  'syncing',
  'synced',
  'conflict',
  'error',
  'disabled'
);

create table public.omie_client_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  external_client_id text,
  external_portal_url text,
  status public.omie_integration_status not null default 'not_connected',
  last_synced_at timestamptz,
  last_error text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.omie_client_mappings is
  'Mapeamento 1:1 entre um tenant (empresa cliente da WJB) e o cliente correspondente no Omie.G-Click — nunca mapeia direto a um usuário.';
comment on column public.omie_client_mappings.external_client_id is
  'Identificador do cliente no Omie.G-Click (ex.: codigo_cliente_omie). Nulo até a primeira sincronização bem-sucedida.';
comment on column public.omie_client_mappings.external_portal_url is
  'Link manual (staff), aberto em nova aba, para a Visão do Cliente no Portal Contábil — nunca um iframe, nunca SSO.';

create index omie_client_mappings_status_idx on public.omie_client_mappings (status);

alter table public.omie_client_mappings enable row level security;

-- Leitura: staff vê tudo; membro do tenant vê só o mapeamento da própria
-- empresa (necessário pro CTA "Ver no Portal Contábil" do Portal do
-- Cliente) — mesmo padrão de `obligations_select_staff_or_tenant_member`.
create policy "omie_mappings_select_staff_or_tenant_member"
  on public.omie_client_mappings for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

-- Escrita: só staff. É julgamento/config profissional da WJB sobre a
-- integração, não algo que o cliente da empresa configura sozinho — mesmo
-- racional de `obligations_write_staff_only`.
create policy "omie_mappings_write_staff_only"
  on public.omie_client_mappings for all
  using (public.is_staff())
  with check (public.is_staff());
