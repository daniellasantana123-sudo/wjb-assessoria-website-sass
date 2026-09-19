-- SAAS FASE 2 — "Guias": em vez de uma tabela nova, é uma categoria dentro
-- de Documentos (mesma infraestrutura de Storage/RLS já existente) — uma
-- guia de pagamento (DAS, DARF etc.) é, na prática, um arquivo como
-- qualquer outro; só muda onde aparece listada.

alter table public.documents
  add column category text not null default 'documento'
  check (category in ('documento', 'guia'));
