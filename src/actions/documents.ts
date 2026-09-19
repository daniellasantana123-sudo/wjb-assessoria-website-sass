"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireTenantAccess, requireStaffSession } from "@/lib/auth/dal";
import type { DocumentCategory } from "@/types/database";

export type DocumentActionState = { error: string } | undefined;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — limite razoável pra documento contábil.

/**
 * Upload de documento (SAAS FASE 2) — qualquer membro da empresa (ou
 * staff) pode enviar, mesma regra da RLS do bucket (0004) e da tabela
 * `documents` (0005). Caminho no Storage: `{tenantId}/{timestamp}-{nome}`
 * — prefixo de timestamp evita colisão entre dois arquivos com o mesmo
 * nome sem esconder o nome original do usuário.
 */
export async function uploadDocument(
  tenantId: string,
  _prevState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const session = await requireTenantAccess(tenantId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "Arquivo maior que 20MB. Envie um arquivo menor." };
  }

  const category: DocumentCategory = formData.get("category") === "guia" ? "guia" : "documento";

  const storagePath = `${tenantId}/${Date.now()}-${file.name}`;
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) {
    console.error("[documents] falha no upload:", uploadError);
    return { error: "Não foi possível enviar o arquivo." };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    tenant_id: tenantId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: session.userId,
    category,
  });

  if (insertError) {
    console.error("[documents] falha ao salvar metadado:", insertError);
    // Não deixa órfão no Storage sem registro no banco.
    await supabase.storage.from("documents").remove([storagePath]);
    return { error: "Não foi possível registrar o documento." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "document.uploaded",
    entity: "document",
    entity_id: storagePath,
    metadata: { file_name: file.name, size_bytes: file.size },
  });

  revalidatePath(`/portal/documentos`);
  revalidatePath(`/portal/guias`);
  revalidatePath(`/admin/empresas/${tenantId}`);
  return undefined;
}

/**
 * Apagar documento é ação de staff — mesma regra da RLS (0004/0005).
 * Recebe só `documentId` de propósito (revisão de segurança, SAAS FASE
 * 6) — `tenant_id` e `storage_path` sempre vêm do próprio registro no
 * banco, nunca de parâmetros vindos do cliente (que antes eram 3 valores
 * client-trusted independentes, sem nada cruzando um com o outro).
 */
export async function deleteDocument(documentId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("tenant_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) return;

  await supabase.storage.from("documents").remove([document.storage_path]);
  await supabase.from("documents").delete().eq("id", documentId);

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: document.tenant_id,
    action: "document.deleted",
    entity: "document",
    entity_id: documentId,
    metadata: { storage_path: document.storage_path },
  });

  revalidatePath(`/portal/documentos`);
  revalidatePath(`/portal/guias`);
  revalidatePath(`/admin/empresas/${document.tenant_id}`);
}
