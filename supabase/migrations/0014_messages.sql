-- SAAS FASE 3 — "Mensagens": canal de conversa direta e contínua entre a
-- empresa cliente e a WJB, sem assunto nem status (diferente de Tickets —
-- ver 0012_tickets.sql — que é o canal formal/rastreável). Uma única
-- conversa por empresa: todo mundo daquela empresa (e qualquer staff)
-- escreve na mesma thread, sem sub-conversas.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

comment on table public.messages is 'Conversa direta e contínua entre a empresa cliente e a WJB — uma thread por empresa, sem assunto/status (ver tickets para o canal formal).';

create index messages_tenant_id_idx on public.messages (tenant_id);
create index messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;

-- Mesmo racional de tickets/ticket_messages: staff lê/escreve em qualquer
-- empresa; membro do tenant só na própria. Não existe "status" pra
-- restringir mudança — as duas pontas sempre podem escrever.
create policy "messages_select_staff_or_tenant_member"
  on public.messages for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "messages_insert_staff_or_tenant_member"
  on public.messages for insert
  with check (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
