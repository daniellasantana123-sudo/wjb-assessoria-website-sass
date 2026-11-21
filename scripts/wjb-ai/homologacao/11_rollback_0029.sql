-- Rollback da 0029 (homologação).
drop trigger if exists fiscal_requests_guard_assignee on public.fiscal_requests;
drop function if exists public.guard_fiscal_request_assignee();
drop index if exists public.fiscal_requests_review_queue_idx;
alter table public.fiscal_requests
  drop column if exists review_due_at,
  drop column if exists priority,
  drop column if exists assigned_to;
