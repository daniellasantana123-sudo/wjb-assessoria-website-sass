drop index if exists public.fiscal_requests_queue_idx;
alter table public.fiscal_request_events drop column if exists actor_kind;
alter table public.fiscal_requests
  drop column if exists needs_intervention,
  drop column if exists last_error,
  drop column if exists next_attempt_at,
  drop column if exists attempt_count;
