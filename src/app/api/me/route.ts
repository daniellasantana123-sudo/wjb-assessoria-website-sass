import { NextResponse } from "next/server";

import { getSession, getTenantRole } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { getPermissions } from "@/lib/permissions/permissions";

/**
 * AuthContext da sessão atual (Fase 1 do wjb-saas-mvp, 2026-09-20) —
 * endpoint novo, não duplica nenhuma Server Action existente. Usa
 * `getSession()` (não `requireSession()`, que redireciona — inadequado
 * pra uma rota JSON) e responde 401 sem sessão, em vez de redirecionar.
 *
 * `organizationId`/`role` refletem a empresa ATIVA (Fase 2 — organization
 * switcher), não sempre a primeira. Só existem pro cliente (não staff),
 * porque staff não é `tenant_member` de nenhuma empresa — acessa via RLS
 * de `is_staff()`, não via vínculo de tenant.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let organizationId: string | null = null;
  let role: "owner" | "member" | null = null;

  if (!session.isWjbStaff) {
    const tenant = await getActiveTenant(session.userId);
    if (tenant) {
      organizationId = tenant.id;
      role = await getTenantRole(tenant.id);
    }
  }

  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    fullName: session.fullName,
    isWjbStaff: session.isWjbStaff,
    staffRole: session.staffRole,
    organizationId,
    role,
    permissions: getPermissions(session, role),
  });
}
