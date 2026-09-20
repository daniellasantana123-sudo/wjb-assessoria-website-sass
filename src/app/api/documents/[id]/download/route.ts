import { NextResponse } from "next/server";

import { createClient } from "@/lib/db/supabase/server";
import { getSession, getTenantRole } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";

/**
 * Download de documento (Fase 3 do wjb-saas-mvp, 2026-09-20) — substitui o
 * link direto pra uma URL assinada gerada com antecedência pra toda a
 * lista (o que impedia auditar cada download individualmente). Aqui a URL
 * é gerada na hora, só quando alguém de fato clica, com validade curta
 * (60s — tempo suficiente pra completar o redirect, não pra compartilhar
 * o link depois), e o clique vira uma linha em `audit_log`
 * (`document.downloaded`).
 *
 * A consulta ao documento usa o client normal (RLS), não o admin client —
 * é a própria RLS de `documents_select_staff_or_tenant_member` (0005) que
 * garante isolamento entre empresas: um `id` de documento de outra empresa
 * simplesmente não é retornado pela query, então nunca chega a gerar URL
 * nenhuma. O check de `hasPermission` abaixo é defesa em profundidade,
 * não o mecanismo do qual o isolamento depende.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("tenant_id, storage_path, file_name")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const tenantRole = session.isWjbStaff ? null : await getTenantRole(document.tenant_id);
  if (!hasPermission(session, "documents.read", tenantRole)) {
    return NextResponse.json({ error: "Sem permissão para acessar este documento." }, {
      status: 403,
    });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.storage_path, 60);

  if (signError || !signed) {
    console.error("[documents] falha ao gerar URL de download:", signError);
    return NextResponse.json({ error: "Não foi possível gerar o link de download." }, {
      status: 500,
    });
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: document.tenant_id,
    action: "document.downloaded",
    entity: "document",
    entity_id: id,
    metadata: { file_name: document.file_name },
  });

  return NextResponse.redirect(signed.signedUrl);
}
