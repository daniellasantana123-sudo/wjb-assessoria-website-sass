-- =====================================================================
-- WJB AI - núcleo fiscal (F1, 2026-11-20). SOMENTE ADITIVA.
--
-- ESTADO: escrita e revisada, NÃO APLICADA em produção. O código do módulo
-- não depende destas tabelas enquanto WJB_AI_ENABLED estiver desligado.
-- Aplicar só com aprovação (docs/wjb-ai/11-RUNBOOK-E-ROLLBACK.md tem o
-- rollback: drop das 5 tabelas, nada existente é alterado).
--
-- Regras de segurança:
-- - nenhuma coluna guarda senha gov.br, PFX, chave privada ou token: o
--   certificado é só uma REFERÊNCIA a cofre externo;
-- - tenant_id em todas as tabelas, RLS ligada em todas;
-- - eventos e tentativas de envio são append-only e só o servidor (service
--   role) escreve - nenhum usuário consegue forjar um "AUTORIZADA".
-- =====================================================================

create table public.fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  -- Parametrização definida e aprovada pelo contador; nunca por IA.
  municipality_ibge_code text,
  service_settings jsonb not null default '{}'::jsonb,
  max_amount_cents_without_review integer not null default 0 check (max_amount_cents_without_review >= 0),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, version)
);

create table public.fiscal_authorization_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('procuracao', 'certificado_proprio', 'consentimento_assistido')),
  scope text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  valid_until date not null,
  evidence_reference text,          -- onde a evidência está guardada, não o documento em si
  certificate_vault_reference text, -- referência ao cofre; NUNCA o PFX ou a senha
  registered_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.fiscal_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  document_type text not null default 'NFSE' check (document_type = 'NFSE'),
  status text not null default 'RECEBIDA' check (status in (
    'RECEBIDA','TRIAGEM','DADOS_PENDENTES','VALIDACAO_FISCAL','BLOQUEADA','REVISAO_HUMANA',
    'PRONTA_PARA_CONFIRMACAO','CONFIRMADA','AUTORIZADA_PARA_ENVIO','ENFILEIRADA','ENVIANDO',
    'RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL','REJEITADA','AUTORIZADA',
    'DOCUMENTOS_DISPONIVEIS','NOTIFICADA')),
  idempotency_key text not null,
  draft_snapshot jsonb not null,
  draft_hash text not null,
  policy_decision text check (policy_decision in ('BLOCKED','HUMAN_REVIEW','READY_FOR_CONFIRMATION')),
  policy_reasons text[] not null default '{}',
  channel text not null default 'portal' check (channel in ('portal', 'whatsapp', 'admin')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.fiscal_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

create table public.fiscal_issuance_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fiscal_requests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  environment text not null check (environment in ('mock', 'homologacao', 'producao')),
  idempotency_key text not null,
  outcome text not null check (outcome in ('AUTORIZADA', 'REJEITADA', 'RESULTADO_INDETERMINADO')),
  official_reference text,
  rejection_code text,
  simulated boolean not null,
  created_at timestamptz not null default now()
);

create index fiscal_profiles_tenant_idx on public.fiscal_profiles (tenant_id);
create index fiscal_grants_tenant_idx on public.fiscal_authorization_grants (tenant_id, status);
create index fiscal_requests_tenant_status_idx on public.fiscal_requests (tenant_id, status, created_at desc);
create index fiscal_events_request_idx on public.fiscal_request_events (request_id, created_at);
create index fiscal_attempts_request_idx on public.fiscal_issuance_attempts (request_id);
-- Uma única tentativa AUTORIZADA por pedido, garantido no banco.
create unique index fiscal_attempts_one_authorized
  on public.fiscal_issuance_attempts (request_id) where outcome = 'AUTORIZADA';

alter table public.fiscal_profiles enable row level security;
alter table public.fiscal_authorization_grants enable row level security;
alter table public.fiscal_requests enable row level security;
alter table public.fiscal_request_events enable row level security;
alter table public.fiscal_issuance_attempts enable row level security;

-- Leitura: equipe ou membro ativo da empresa (my_tenant_ids já filtra status).
create policy fiscal_profiles_select on public.fiscal_profiles for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_profiles_write_staff on public.fiscal_profiles for all
  using (public.is_staff()) with check (public.is_staff());

create policy fiscal_grants_select on public.fiscal_authorization_grants for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_grants_write_staff on public.fiscal_authorization_grants for all
  using (public.is_staff()) with check (public.is_staff());

create policy fiscal_requests_select on public.fiscal_requests for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
-- Cliente só cria pedido na própria empresa, em nome próprio, no estado inicial.
create policy fiscal_requests_insert_member on public.fiscal_requests for insert
  with check (
    tenant_id in (select public.my_tenant_ids())
    and created_by = auth.uid()
    and status = 'RECEBIDA'
  );
-- Equipe move o pedido só até AUTORIZADA_PARA_ENVIO. Os estados de
-- transmissão e de resultado oficial são exclusivos do servidor (service
-- role): ninguém consegue forjar "AUTORIZADA" pela API do banco.
create policy fiscal_requests_update_staff on public.fiscal_requests for update
  using (
    public.is_staff()
    and status not in ('ENFILEIRADA','ENVIANDO','RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL',
                       'REJEITADA','AUTORIZADA','DOCUMENTOS_DISPONIVEIS','NOTIFICADA')
  )
  with check (
    public.is_staff()
    and status not in ('ENFILEIRADA','ENVIANDO','RESULTADO_INDETERMINADO','CONCILIACAO_OFICIAL',
                       'REJEITADA','AUTORIZADA','DOCUMENTOS_DISPONIVEIS','NOTIFICADA')
  );

-- Eventos e tentativas: só leitura para usuários; escrita apenas pelo
-- servidor com service role (sem policy de insert = negado para o resto).
create policy fiscal_events_select on public.fiscal_request_events for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));
create policy fiscal_attempts_select on public.fiscal_issuance_attempts for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

grant select, insert, update on public.fiscal_requests to authenticated;
grant select on public.fiscal_request_events, public.fiscal_issuance_attempts to authenticated;
grant select, insert, update on public.fiscal_profiles, public.fiscal_authorization_grants to authenticated;
