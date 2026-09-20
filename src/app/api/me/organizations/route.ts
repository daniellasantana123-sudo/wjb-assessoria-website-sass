import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { getMyOrganizations } from "@/lib/tenant";

/**
 * Empresas do usuário logado (Fase 1 do wjb-saas-mvp, 2026-09-20; reaproveita
 * `getMyOrganizations` desde a Fase 2, que também alimenta o organization
 * switcher). Staff não é `tenant_member` de nenhuma empresa (acessa via RLS
 * de `is_staff()`, não vínculo) — pra staff, a lista sempre vem vazia, o
 * que é o resultado correto, não uma falha de busca.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.isWjbStaff) {
    return NextResponse.json({ organizations: [] });
  }

  const organizations = await getMyOrganizations(session.userId);
  return NextResponse.json({ organizations });
}
