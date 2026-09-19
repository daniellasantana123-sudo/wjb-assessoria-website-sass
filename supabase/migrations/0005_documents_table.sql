-- SAAS FASE 2 — "Documentos" (primeiro item de conteúdo real do Portal do
-- Cliente, além da empresa). Metadados no Postgres (listagem/RLS mais
-- simples que consultar o Storage direto); o arquivo em si vive no bucket
-- `documents` (0004_storage_documents.sql) no mesmo caminho
-- `{tenant_id}/{arquivo}` — `storage_path` aqui aponta pra lá.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.documents is 'Metadados dos arquivos do bucket `documents` — o arquivo em si vive no Storage, ver storage_path.';

create index documents_tenant_id_idx on public.documents (tenant_id);

alter table public.documents enable row level security;

-- Mesmo racional das outras tabelas: staff vê/gerencia tudo; membro só a
-- própria empresa (via my_tenant_ids(), já criada em
-- 0003_fix_tenant_members_rls_recursion.sql). Editar não existe (documento
-- é substituído por um novo envio, não editado); apagar é só staff — mesmo
-- padrão do bucket.

create policy "documents_select_staff_or_tenant_member"
  on public.documents for select
  using (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "documents_insert_staff_or_tenant_member"
  on public.documents for insert
  with check (public.is_staff() or tenant_id in (select public.my_tenant_ids()));

create policy "documents_delete_staff_only"
  on public.documents for delete
  using (public.is_staff());
