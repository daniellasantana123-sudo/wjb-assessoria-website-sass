-- Rollback da 0032 (homologação): planos aprovados voltam a rascunho.
drop trigger if exists commercial_settings_history on public.commercial_settings;
drop function if exists public.commercial_setting_history();
drop table if exists public.commercial_setting_changes;
drop trigger if exists commercial_plans_approval on public.commercial_plans;
drop function if exists public.commercial_plan_approval();
update public.commercial_plans set status = 'draft' where status = 'approved';
alter table public.commercial_plans drop constraint if exists commercial_plans_approval_complete;
alter table public.commercial_plans drop constraint if exists commercial_plans_status_check;
alter table public.commercial_plans
  drop column if exists approved_at, drop column if exists approved_by,
  drop column if exists approval_reference, drop column if exists effective_from;
alter table public.commercial_plans add constraint commercial_plans_status_check check (status in ('draft', 'archived'));
