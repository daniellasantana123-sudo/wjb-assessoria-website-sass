import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { DocumentCategory } from "@/types/database";

export interface DocumentListItem {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedByName: string | null;
  signedUrl: string | null;
  storagePath: string;
}

/**
 * Lista os documentos de uma empresa com URL assinada temporária pra cada
 * um (o bucket é privado — não existe URL pública, ver
 * `supabase/migrations/0004_storage_documents.sql`). RLS de `documents` já
 * restringe a query à empresa certa; aqui só formata pra exibição.
 * `category` filtra Documentos de Guias (mesma tabela, ver
 * `0009_document_category.sql`) — omitir pra listar as duas juntas.
 *
 * As URLs assinadas saem de uma única chamada em lote (`createSignedUrls`)
 * em vez de uma `createSignedUrl` por linha dentro de um loop — evita um
 * round-trip HTTP ao Storage por documento (N+1 real, achado na revisão de
 * performance de 2026-09-17).
 */
export async function listTenantDocuments(
  tenantId: string,
  category?: DocumentCategory,
): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("id, file_name, size_bytes, created_at, storage_path, profiles(full_name)")
    .eq("tenant_id", tenantId);

  if (category) query = query.eq("category", category);

  const { data: rows } = await query.order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const { data: signedUrls } = await supabase.storage
    .from("documents")
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 10,
    );

  const signedUrlByPath = new Map((signedUrls ?? []).map((entry) => [entry.path, entry.signedUrl]));

  return rows.map((row) => {
    const uploader = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      fileName: row.file_name,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      uploadedByName: uploader?.full_name ?? null,
      signedUrl: signedUrlByPath.get(row.storage_path) ?? null,
      storagePath: row.storage_path,
    };
  });
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
