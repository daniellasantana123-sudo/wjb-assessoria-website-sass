import "server-only";

import { createClient } from "@/lib/db/supabase/server";

/**
 * Storage (SAAS FASE 1, último item). Infraestrutura pronta — bucket
 * privado `documents` + RLS por tenant (ver
 * `supabase/migrations/0004_storage_documents.sql`) — mas ainda sem UI de
 * "Documentos" (essa é a SAAS FASE 2, item separado no roadmap). Estas
 * funções usam o client normal (respeita RLS) para que a mesma regra do
 * banco (staff vê tudo, membro só a própria empresa) valha aqui também.
 *
 * Convenção de caminho: `{tenantId}/{nome-do-arquivo}`.
 */

export async function uploadDocument(tenantId: string, file: File, fileName: string) {
  const supabase = await createClient();
  const path = `${tenantId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return data;
}

export async function listDocuments(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("documents").list(tenantId);

  if (error) throw error;
  return data;
}

/** URL assinada temporária — o bucket é privado, não existe URL pública. */
export async function getDocumentSignedUrl(path: string, expiresInSeconds = 60 * 10) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/** Apagar é ação de staff — a RLS do bucket já bloqueia quem não é staff. */
export async function deleteDocument(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("documents").remove([path]);

  if (error) throw error;
}
