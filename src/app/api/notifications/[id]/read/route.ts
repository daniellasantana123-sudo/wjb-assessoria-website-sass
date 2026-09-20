import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { markNotificationAsReadAndGetLink } from "@/lib/notifications";

/**
 * Clicar numa notificação marca ela como lida e redireciona pro destino
 * real (Fase 6 do wjb-saas-mvp) - mesmo padrão de "auditar/agir no
 * redirect" de `/api/documents/[id]/download`. Isolamento entre pessoas
 * vem da RLS de `notifications` (`recipient_id = auth.uid()`), checada
 * dentro de `markNotificationAsReadAndGetLink` - um `id` de outra pessoa
 * nunca é encontrado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const link = await markNotificationAsReadAndGetLink(id);

  if (!link) {
    return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
  }

  return NextResponse.redirect(new URL(link, request.url), 307);
}
