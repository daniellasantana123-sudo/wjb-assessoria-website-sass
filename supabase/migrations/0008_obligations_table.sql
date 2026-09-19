-- SAAS FASE 2 — "Obrigações": diferente de Documentos (bidirecional), aqui
-- só a WJB cria/gerencia — é o julgamento profissional do contador sobre
-- os prazos fiscais da empresa, não algo que o cliente reporta sozinho.
-- Cliente só visualiza e acompanha o status.

create type public.obligation_status as enum ('pending', 'done');

create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  status public.obligation_status not null default 'pending',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.obligations is 'Prazos fiscais/obrigações acessórias por empresa — criados pela WJB, cliente só acompanha.';

create index obligations_tenant_id_idx on public.obligations (tenant_id);
create index obligations_due_date_idx on public.obligations (due_date);

alter table public.obligations enable row level security;

create policy "obligations_select_staff_or_tenant_member"
  on public.obligations for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "obligations_write_staff_only"
  on public.obligations for all
  using (public.is_staff())
  with check (public.is_staff());
