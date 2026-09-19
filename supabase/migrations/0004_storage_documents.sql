-- SAAS FASE 1 — Storage (o último item da fase). Bucket privado para
-- documentos das empresas clientes (SAAS FASE 2 "Documentos" ainda não tem
-- UI própria — isso só prepara a infraestrutura: bucket + RLS).
--
-- Convenção de caminho: todo objeto fica em `{tenant_id}/{arquivo}` dentro
-- do bucket `documents`. `(storage.foldername(name))[1]` extrai o primeiro
-- segmento do caminho (o tenant_id) para as policies abaixo.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- `storage.objects` já vem com RLS habilitada por padrão no Supabase — só o
-- dono interno da tabela (não o usuário do SQL Editor) pode alterar isso, e
-- não é preciso: não incluir `alter table ... enable row level security`
-- aqui (falha com "42501: must be owner of table objects").

-- Comparação sempre em texto (nunca cast do caminho pra uuid): um caminho
-- fora do padrão só deixa de bater na comparação, em vez de derrubar a
-- query inteira com erro de cast inválido.

create policy "documents_select_staff_or_tenant_member"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (
      public.is_staff()
      or (storage.foldername(name))[1] in (select public.my_tenant_ids()::text)
    )
  );

create policy "documents_insert_staff_or_tenant_member"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (
      public.is_staff()
      or (storage.foldername(name))[1] in (select public.my_tenant_ids()::text)
    )
  );

-- Editar/apagar documento é ação de staff (evita perda de dado acidental
-- por um usuário de empresa cliente) — mesmo racional de
-- `tenant_members_write_staff_only`.
create policy "documents_update_staff_only"
  on storage.objects for update
  using (bucket_id = 'documents' and public.is_staff());

create policy "documents_delete_staff_only"
  on storage.objects for delete
  using (bucket_id = 'documents' and public.is_staff());
