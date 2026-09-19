-- SAAS FASE 4 — "Leads": persiste o que os formulários do site (contato,
-- proposta, abrir empresa, trocar de contador, simulador de honorários,
-- assistente virtual, newsletter) enviam pra /api/leads. Até aqui, o
-- endpoint só validava e dava `console.log` (seção 36 — nenhum provider de
-- e-mail/CRM confirmado ainda) — os leads se perdiam de verdade.
--
-- Tabela genérica o bastante pra cobrir tanto um lead completo (nome,
-- telefone, assunto, mensagem) quanto uma inscrição de newsletter (só
-- e-mail) — por isso a maioria das colunas é opcional.

create type public.lead_status as enum ('new', 'contacted', 'won', 'lost');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  phone text,
  company text,
  cnpj text,
  city text,
  state text,
  business_activity text,
  service_interest text,
  message text,
  form_context text not null,
  source_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now()
);

comment on table public.leads is 'Leads capturados pelos formulários do site (contato, proposta, newsletter etc.) — pipeline comercial da WJB, sem relação com tenants/clientes já cadastrados.';

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

-- Qualquer visitante do site (nem autenticado) pode criar um lead — é o
-- próprio formulário público. Ler/gerenciar é só staff (pipeline comercial
-- interno da WJB, sem relação com tenant_members/RLS multiempresa).
create policy "leads_insert_public"
  on public.leads for insert
  with check (true);

create policy "leads_select_staff_only"
  on public.leads for select
  using (public.is_staff());

create policy "leads_update_staff_only"
  on public.leads for update
  using (public.is_staff());
