"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { ACTIVE_TENANT_COOKIE, getMyOrganizations } from "@/lib/tenant";

/**
 * Organization switcher (Fase 2 do wjb-saas-mvp, 2026-09-20). O `tenantId`
 * vem de um `<select>` no Portal — nunca é confiado sozinho: sempre
 * revalidado contra as empresas reais do usuário antes de gravar o cookie.
 * Tentar trocar pra uma empresa que a pessoa não é membro é ignorado em
 * silêncio (mesma postura de outras Server Actions do projeto que recebem
 * um id que não pertence ao chamador — nunca dá erro que revele se aquele
 * id existe ou não, evita enumeração).
 */
export async function switchActiveTenant(formData: FormData) {
  const session = await requireSession();
  const tenantId = String(formData.get("tenantId") ?? "");

  const organizations = await getMyOrganizations(session.userId);
  const isMember = organizations.some((org) => org.id === tenantId);
  if (!isMember) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/portal");
}
