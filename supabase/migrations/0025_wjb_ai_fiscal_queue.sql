-- =====================================================================
-- WJB AI - fila de processamento simulado e revisão (F3, 2026-11-20).
-- SOMENTE ADITIVA. Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/04_rollback_0025.sql
-- =====================================================================

-- Controle da fila: tentativas, espera entre elas (backoff) e último erro.
alter table public.fiscal_requests
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists needs_intervention boolean not null default false;

-- Quem fez cada passo: pessoa (actor_id) ou o processamento automático.
alter table public.fiscal_request_events
  add column if not exists actor_kind text not null default 'user'
    check (actor_kind in ('user', 'system'));

-- Fila: pedidos prontos para envio ou aguardando conciliação, por vencimento.
create index if not exists fiscal_requests_queue_idx
  on public.fiscal_requests (status, next_attempt_at)
  where status in ('AUTORIZADA_PARA_ENVIO', 'ENFILEIRADA', 'RESULTADO_INDETERMINADO', 'CONCILIACAO_OFICIAL');

comment on column public.fiscal_requests.needs_intervention is
  'Fila de erros: depois do limite de tentativas o pedido para e espera uma pessoa da WJB.';
