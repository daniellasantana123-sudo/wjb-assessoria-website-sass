-- SAAS FASE 3 — "Notificações": centro de notificações in-app (não é o
-- item "E-mail" da SAAS FASE 5 — esse é sobre envio de e-mail
-- transacional, um provedor externo ainda não confirmado; isto aqui é só
-- uma caixa de avisos dentro do próprio site). Eventos reais de Tickets e
-- Mensagens (criado/respondido/status mudou) geram uma linha por
-- destinatário — nunca uma linha "global" compartilhada, cada pessoa lê e
-- marca como lida a própria cópia.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  type text not null,
  body text not null,
  link text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is 'Notificações in-app, uma linha por destinatário — eventos reais de tickets/mensagens (nunca inventado). Inserção só via service_role (fan-out nas Server Actions), sem policy de insert para authenticated.';

create index notifications_recipient_id_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- Cada pessoa só vê e só marca como lida a própria notificação. Sem
-- policy de insert pra `authenticated` — o fan-out (uma linha por
-- destinatário, que pode não ser quem disparou o evento) só acontece via
-- client admin (service_role) dentro das Server Actions já autorizadas.
create policy "notifications_select_own"
  on public.notifications for select
  using (recipient_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
