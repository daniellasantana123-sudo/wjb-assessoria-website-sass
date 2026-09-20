import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { DocumentCategory } from "@/types/database";

export interface DocumentListItem {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedByName: string | null;
  storagePath: string;
}

/**
 * Lista os documentos de uma empresa (Fase 3 do wjb-saas-mvp, 2026-09-20).
 * RLS de `documents` já restringe a query à empresa certa; aqui só
 * formata pra exibição e filtra por categoria/busca.
 *
 * Não gera mais URL assinada aqui (removido nesta fase) — o link de
 * download agora passa por `GET /api/documents/[id]/download`, que gera a
 * URL na hora (60s de validade) e grava auditoria (`document.downloaded`).
 * Gerar a URL só quando alguém de fato clica em baixar, em vez de pra cada
 * item da lista a cada carregamento de página, também elimina a chamada
 * em lote ao Storage que existia só pra exibir a lista.
 *
 * `query` filtra por nome de arquivo (case-insensitive, `ilike`) — a busca
 * pedida na Fase 3. `category` continua filtrando Documentos de Guias
 * (mesma tabela, ver `0009_document_category.sql`).
 */
export async function listTenantDocuments(
  tenantId: string,
  category?: DocumentCategory,
  query?: string,
): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  let dbQuery = supabase
    .from("documents")
    .select("id, file_name, size_bytes, created_at, storage_path, profiles(full_name)")
    .eq("tenant_id", tenantId);

  if (category) dbQuery = dbQuery.eq("category", category);
  if (query && query.trim()) dbQuery = dbQuery.ilike("file_name", `%${query.trim()}%`);

  const { data: rows } = await dbQuery.order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  return rows.map((row) => {
    const uploader = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      fileName: row.file_name,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      uploadedByName: uploader?.full_name ?? null,
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

/**
 * Allowlist de MIME (Fase 3) — tipos de arquivo que fazem sentido pra um
 * escritório de contabilidade trocar com clientes: PDF, imagens de
 * documento escaneado, planilhas/CSV, Office, texto simples, e XML (NFe/
 * NFSe, SPED e afins são XML). Bloqueia executáveis, scripts e outros
 * tipos sem uso legítimo aqui — reduz superfície de ataque, não é
 * exaustivo pra "todo tipo de arquivo do mundo" de propósito.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/xml",
  "application/xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
}

/**
 * Sanitiza o nome do arquivo antes de virar parte da chave do Storage
 * (Fase 3) — o nome original do arquivo vem 100% do cliente (`file.name`
 * de um `<input type="file">`), então nunca é seguro concatenar direto
 * numa storage key: remove separador de caminho (evita criar
 * subpastas/atravessar prefixos), caracteres de controle, e reduz a
 * qualquer coisa fora de um conjunto seguro pra underscore. Mantém o nome
 * legível (extensão preservada) em vez de gerar um nome opaco, porque o
 * nome original é mostrado na UI de listagem.
 */
export function sanitizeFileName(rawName: string): string {
  const withoutPath = rawName.replace(/^.*[/\\]/, "");
  const safe = withoutPath
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 200);

  return safe || "arquivo";
}
