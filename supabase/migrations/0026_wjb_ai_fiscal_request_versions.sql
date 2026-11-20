-- =====================================================================
-- WJB AI - versões do pedido corrigido (F3, 2026-11-20). SOMENTE ADITIVA.
-- Quando o contador pede correção, o cliente corrige o MESMO pedido; o
-- rascunho anterior é guardado aqui, sem apagar histórico.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/05_rollback_0026.sql
-- Depende de: 0024 (fiscal_requests), 0001 (tenants, profiles),
--   0018/0021 (my_tenant_ids, is_staff com status).
-- =====================================================================
create table public.fiscal_request_versions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version integer not null check (version >= 1),
  draft_snapshot jsonb not null,
  draft_hash text not null,
  replaced_by uuid references public.profiles (id),
  replaced_at timestamptz not null default now(),
  unique (request_id, version)
);

create index fiscal_request_versions_request_idx on public.fiscal_request_versions (request_id, version);

alter table public.fiscal_request_versions enable row level security;

-- Leitura: equipe ou membro ativo da empresa. Escrita: só o servidor (service role).
create policy fiscal_request_versions_select on public.fiscal_request_versions for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

grant select on public.fiscal_request_versions to authenticated;
