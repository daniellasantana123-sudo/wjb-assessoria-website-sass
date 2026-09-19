-- SAAS FASE 3/4 — "Tickets": primeiro item de Comunicação (seção 34), e
-- também o último item pendente do Admin WJB (mesma feature vista dos dois
-- lados — cliente abre/acompanha no Portal, qualquer papel de staff
-- responde e gerencia status no Admin, ver `canHandleSupport` em
-- `src/lib/permissions/roles.ts`). Diferente de Obrigações (só staff
-- escreve): aqui as duas pontas conversam, então o modelo é
-- tickets + ticket_messages (thread), não uma tabela única.

create type public.ticket_status as enum ('open', 'in_progress', 'closed');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject text not null,
  status public.ticket_status not null default 'open',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.tickets is 'Chamados de suporte — cliente abre, staff responde/gerencia status.';

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  -- desnormalizado de tickets.tenant_id de propósito: RLS de ticket_messages
  -- não precisa de subquery/join em tickets pra saber a empresa da mensagem
  -- (mesmo racional de sempre neste projeto — nunca fazer RLS consultar
  -- outra tabela via join direto, só coluna própria ou função SECURITY
  -- DEFINER).
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

comment on table public.ticket_messages is 'Mensagens de um ticket (thread) — cliente e staff, em ordem cronológica.';

create index tickets_tenant_id_idx on public.tickets (tenant_id);
create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);
create index ticket_messages_tenant_id_idx on public.ticket_messages (tenant_id);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- tickets: staff vê/abre tudo; membro do tenant vê/abre só da própria
-- empresa. Mudar status é só staff (mesmo padrão de obligations — o
-- cliente não fecha um chamado sozinho, só a WJB confirma resolvido).
create policy "tickets_select_staff_or_tenant_member"
  on public.tickets for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "tickets_insert_staff_or_tenant_member"
  on public.tickets for insert
  with check (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "tickets_update_status_staff_only"
  on public.tickets for update
  using (public.is_staff())
  with check (public.is_staff());

-- ticket_messages: mesma regra de tickets — as duas pontas podem ler e
-- responder na própria thread.
create policy "ticket_messages_select_staff_or_tenant_member"
  on public.ticket_messages for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "ticket_messages_insert_staff_or_tenant_member"
  on public.ticket_messages for insert
  with check (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
