import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import type { StaffRole, TenantMemberRole } from "@/types/database";

/**
 * Data Access Layer de autenticação (padrão recomendado pela própria
 * documentação desta versão do Next.js — ver
 * node_modules/next/dist/docs/01-app/02-guides/data-security.md). Toda
 * verificação de sessão/permissão do produto passa por aqui, nunca
 * diretamente por `proxy.ts` (que só faz o check otimista de redirecionar
 * usuário deslogado — ver `proxy.ts` na raiz do projeto).
 *
 * `cache()` do React memoiza por render pass: chamar `getSession()` várias
 * vezes na mesma requisição (layout + page + componente) dispara só uma
 * consulta.
 */

export interface Session {
  userId: string;
  email: string;
  fullName: string | null;
  isWjbStaff: boolean;
  staffRole: StaffRole | null;
}

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_wjb_staff, staff_role")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isWjbStaff: profile?.is_wjb_staff ?? false,
    staffRole: profile?.staff_role ?? null,
  };
});

/** Exige sessão ativa; redireciona para /login quando não houver. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige sessão de um membro do time WJB (Admin WJB, SAAS FASE 4). */
export async function requireStaffSession(): Promise<Session> {
  const session = await requireSession();
  if (!session.isWjbStaff) redirect("/portal");
  return session;
}

/** Papel do usuário dentro de um tenant específico (Portal do Cliente). */
export const getTenantRole = cache(
  async (tenantId: string): Promise<TenantMemberRole | null> => {
    const session = await getSession();
    if (!session) return null;
    if (session.isWjbStaff) return "owner";

    const supabase = await createClient();
    const { data } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("profile_id", session.userId)
      .single();

    return data?.role ?? null;
  },
);

/** Exige staff OU membro daquele tenant específico — redireciona senão. */
export async function requireTenantAccess(tenantId: string): Promise<Session> {
  const session = await requireSession();
  const role = await getTenantRole(tenantId);
  if (!role) redirect(session.isWjbStaff ? "/admin/empresas" : "/portal");
  return session;
}
