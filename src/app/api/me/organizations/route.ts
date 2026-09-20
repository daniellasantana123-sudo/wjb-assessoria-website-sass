import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/supabase/server";

/**
 * Empresas do usuário logado (Fase 1 do wjb-saas-mvp, 2026-09-20). Staff
 * não é `tenant_member` de nenhuma empresa (acessa via RLS de `is_staff()`,
 * não vínculo) — pra staff, a lista sempre vem vazia, o que é o resultado
 * correto, não uma falha de busca.
 *
 * Retorna todos os vínculos, não só o primeiro — diferente de
 * `getMyPrimaryTenant()` (usado no Portal hoje, que assume uma única
 * empresa por falta de seletor de contexto na UI). Este endpoint já fica
 * pronto pra um seletor multi-empresa futuro, sem precisar mudar o
 * back-end quando ele existir.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.isWjbStaff) {
    return NextResponse.json({ organizations: [] });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenants(id, name, cnpj)")
    .eq("profile_id", session.userId);

  const organizations = (data ?? []).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      id: tenant?.id ?? null,
      name: tenant?.name ?? null,
      cnpj: tenant?.cnpj ?? null,
      role: row.role,
    };
  });

  return NextResponse.json({ organizations });
}
