-- 0023 - Funil comercial de leads (2026-11-09, plano comercial da WJB, Fase 4).
--
-- 1) Status do lead passa de 4 para 7 etapas. Os valores antigos continuam
--    valendo e mudam só de rótulo na tela, então nenhum lead precisa ser
--    convertido:
--      new        -> Novo
--      contacted  -> Em atendimento
--      qualified  -> Qualificado            (novo)
--      proposal_sent -> Proposta enviada    (novo)
--      negotiation   -> Negociação          (novo)
--      won        -> Contratado
--      lost       -> Perdido ou desqualificado
-- 2) Colunas de atribuição e de acompanhamento comercial.
-- 3) submission_id único: o mesmo envio repetido (clique duplo, nova
--    tentativa após erro de rede) não grava o lead duas vezes.
--
-- Pode ser rodada mais de uma vez sem erro (IF NOT EXISTS em tudo).

alter type public.lead_status add value if not exists 'qualified' after 'contacted';
alter type public.lead_status add value if not exists 'proposal_sent' after 'qualified';
alter type public.lead_status add value if not exists 'negotiation' after 'proposal_sent';

alter table public.leads
  add column if not exists submission_id uuid,
  add column if not exists landing_page text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists gclid text,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists next_step text,
  add column if not exists status_changed_at timestamptz;

create unique index if not exists leads_submission_id_key
  on public.leads (submission_id)
  where submission_id is not null;
