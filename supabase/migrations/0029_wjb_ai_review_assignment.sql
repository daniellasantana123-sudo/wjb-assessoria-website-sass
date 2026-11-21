-- =====================================================================
-- WJB AI - Fase 7 (2026-11-21). SOMENTE ADITIVA.
-- Fila de revisão do contador: atribuição, prioridade e prazo (SLA).
-- O prazo é calculado pelo servidor a partir da prioridade quando o pedido
-- entra em revisão; a equipe pode reatribuir e repriorizar (auditado).
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/11_rollback_0029.sql
-- Depende de: 0024 (fiscal_requests), 0001 (profiles), 0021 (is_staff).
-- =====================================================================
alter table public.fiscal_requests
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column priority text not null default 'normal'
    check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  add column review_due_at timestamptz;

create index fiscal_requests_review_queue_idx
  on public.fiscal_requests (status, review_due_at)
  where status = 'REVISAO_HUMANA';

-- Só equipe ativa recebe atribuição.
create function public.guard_fiscal_request_assignee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to
     and not exists (select 1 from public.profiles p
                     where p.id = new.assigned_to and p.is_wjb_staff and p.status = 'active') then
    raise exception 'Só membro ativo da equipe pode receber a revisão.' using errcode = '22023';
  end if;
  -- Prazo: definido ao entrar em revisão e recalculado se a prioridade mudar.
  if new.status = 'REVISAO_HUMANA'
     and (old.status is distinct from 'REVISAO_HUMANA' or new.priority is distinct from old.priority) then
    new.review_due_at := now() + case new.priority
      when 'urgente' then interval '4 hours'
      when 'alta' then interval '8 hours'
      when 'normal' then interval '24 hours'
      else interval '72 hours' end;
  end if;
  return new;
end;
$$;

create trigger fiscal_requests_guard_assignee
  before update on public.fiscal_requests
  for each row execute function public.guard_fiscal_request_assignee();
