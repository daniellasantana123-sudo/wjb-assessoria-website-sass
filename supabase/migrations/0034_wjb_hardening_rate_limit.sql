-- =====================================================================
-- WJB AI - Fase 10A (2026-11-21). SOMENTE ADITIVA. Endurecimento.
--
-- 1) Limite de requisições COMPARTILHADO entre processos (antes só havia
--    um contador em memória por processo, contornável e zerado a cada
--    reinício). Guarda só um hash da chave (nunca o IP em claro), janela
--    fixa por balde, limpeza oportunista do que tem mais de 1 dia.
--    Só o servidor (service role) executa.
-- 2) Índices em tenant_id usados pela RLS (`tenant_id in my_tenant_ids()`)
--    que faltavam em tabelas das migrations 0024-0030.
-- Validada só em homologação; NÃO aplicada em produção.
-- Rollback: scripts/wjb-ai/homologacao/21_rollback_0034.sql
-- =====================================================================

create table public.rate_limit_buckets (
  bucket text primary key check (length(bucket) between 10 and 200),
  window_start timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0)
);
alter table public.rate_limit_buckets enable row level security;
-- Nenhuma política: ninguém lê nem grava pelo navegador.
revoke all on public.rate_limit_buckets from anon, authenticated;

-- Devolve TRUE quando o limite foi ultrapassado nesta chamada.
create function public.rate_limit_hit(p_bucket text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 or p_max < 1 then
    raise exception 'Parâmetros de limite inválidos.' using errcode = '22023';
  end if;
  insert into public.rate_limit_buckets as b (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when b.window_start < now() - make_interval(secs => p_window_seconds) then 1 else b.hits + 1 end,
    window_start = case when b.window_start < now() - make_interval(secs => p_window_seconds) then now() else b.window_start end
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;
  return v_hits > p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

create index if not exists fiscal_request_events_tenant_idx on public.fiscal_request_events (tenant_id);
create index if not exists fiscal_issuance_attempts_tenant_idx on public.fiscal_issuance_attempts (tenant_id);
create index if not exists fiscal_request_versions_tenant_idx on public.fiscal_request_versions (tenant_id);
create index if not exists commercial_acceptances_tenant_idx on public.commercial_acceptances (tenant_id);
create index if not exists commercial_subscriptions_tenant_idx on public.commercial_subscriptions (tenant_id);
