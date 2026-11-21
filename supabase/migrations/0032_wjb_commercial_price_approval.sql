-- =====================================================================
-- WJB AI - Fase 9 (2026-11-21). SOMENTE ADITIVA.
-- Aprovação versionada dos preços dos planos de emissão.
--
-- O responsável pela WJB aprovou em 21/11/2026 os valores dos 5 planos de
-- NFS-e e o desconto do combo (20%). Aprovar preço NÃO libera cobrança:
-- assinatura continua só 'simulado' (CHECK da 0030), e isso não muda aqui.
--
-- Regras gravadas no banco:
-- - plano nasce em rascunho; só vira 'approved' por UPDATE com referência da
--   aprovação e data de vigência; data e autor da aprovação são gravados pelo
--   banco, não pelo navegador;
-- - mudar mensalidade, franquia, excedente ou produto de um plano aprovado o
--   devolve a rascunho (exige nova aprovação); o histórico (0030) guarda cada
--   versão com a vigência;
-- - mudança de configuração comercial (desconto do combo, premissas) também
--   ganha histórico.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/17_rollback_0032.sql
-- Depende de: 0030.
-- =====================================================================

alter table public.commercial_plans drop constraint commercial_plans_status_check;
alter table public.commercial_plans
  add constraint commercial_plans_status_check check (status in ('draft', 'approved', 'archived')),
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles (id),
  add column approval_reference text
    check (approval_reference is null or length(trim(approval_reference)) between 5 and 300),
  add column effective_from date,
  add constraint commercial_plans_approval_complete
    check (status <> 'approved' or (approved_at is not null and approval_reference is not null and effective_from is not null));

create function public.commercial_plan_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      raise exception 'Plano nasce em rascunho: aprove depois, com referência.' using errcode = '42501';
    end if;
    new.approved_at := null; new.approved_by := null; new.approval_reference := null; new.effective_from := null;
    return new;
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    new.approved_by := auth.uid();
    new.effective_from := coalesce(new.effective_from, current_date);
  elsif new.status = 'approved' and row(new.monthly_cents, new.quota, new.overage_cents, new.product)
        is distinct from row(old.monthly_cents, old.quota, old.overage_cents, old.product) then
    -- Preço de plano aprovado mudou: volta a rascunho e exige nova aprovação.
    new.status := 'draft';
    new.approved_at := null; new.approved_by := null; new.approval_reference := null; new.effective_from := null;
  elsif new.status = 'approved' then
    -- Nome/descrição podem mudar; os dados da aprovação ficam congelados.
    new.approved_at := old.approved_at; new.approved_by := old.approved_by;
    new.approval_reference := old.approval_reference; new.effective_from := old.effective_from;
  else
    new.approved_at := null; new.approved_by := null; new.approval_reference := null; new.effective_from := null;
  end if;
  return new;
end;
$$;
-- Nome em ordem alfabética antes de commercial_plans_version: roda primeiro.
create trigger commercial_plans_approval before insert or update on public.commercial_plans
  for each row execute function public.commercial_plan_approval();

create table public.commercial_setting_changes (
  id bigint generated always as identity primary key,
  key text not null,
  before jsonb,
  after jsonb not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create function public.commercial_setting_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.commercial_setting_changes (key, before, after, changed_by)
  values (new.key, case when tg_op = 'UPDATE' then old.value else null end, new.value, auth.uid());
  return null;
end;
$$;
create trigger commercial_settings_history after insert or update on public.commercial_settings
  for each row execute function public.commercial_setting_history();

alter table public.commercial_setting_changes enable row level security;
create policy commercial_setting_changes_select_staff on public.commercial_setting_changes for select using (public.is_staff());
grant select on public.commercial_setting_changes to authenticated;
