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
    .select("full_name, is_wjb_staff, staff_role, status")
    .eq("id", user.id)
    .single();

  /*
   * Conta suspensa (Fase 2 do wjb-saas-mvp, 2026-09-20) — tratada como sem
   * sessão. O JWT em si continua válido até expirar (é isso que
   * `admin.updateUserById(..., { ban_duration })` também endereça, ao
   * bloquear a renovação), mas a checagem aqui é imediata e independe
   * disso: a PRÓXIMA página carregada já vê a conta como deslogada, porque
   * `status` é lido fresco do banco a cada request, não fica no token.
   */
  if (profile?.status === "suspended") return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isWjbStaff: profile?.is_wjb_staff ?? false,
    staffRole: profile?.staff_role ?? null,
  };
});

/**
 * Nível de segurança da autenticação (AAL) da sessão atual (Fase 2 do
 * wjb-saas-mvp, 2026-09-20 — preparação de MFA, sem exigir de ninguém
 * ainda). Memoizado como `getSession()` — chamada sem JWT explícito, o
 * próprio SDK documenta que isso é "fairly quick (microseconds) and
 * rarely uses the network", então rodar em toda página protegida não pesa.
 */
const getAal = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.mfa.getAuthenticatorAssuranceLevel();
});

/** Exige sessão ativa; redireciona para /login quando não houver. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");

  /*
   * Quem tem um fator MFA verificado mas a sessão ainda está em aal1 (login
   * recente só com senha) precisa completar o desafio antes de acessar
   * qualquer página protegida — `/verificar-mfa` não passa por aqui (lê a
   * sessão direto via `getSession()`), então não há loop de redirect.
   */
  const { data: aal } = await getAal();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect("/verificar-mfa");
  }

  return session;
}

/**
 * Sessão para rotas de API e ações que não redirecionam (Fase 10A,
 * 21/11/2026). Quem tem fator MFA verificado mas ainda está em aal1 (só
 * passou pela senha) conta como SEM sessão, igual ao que `requireSession`
 * já fazia nas páginas. Antes, com só a senha vazada dava para baixar
 * documentos e ler dados pelas rotas de API.
 */
export async function getVerifiedSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const { data: aal } = await getAal();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return null;
  return session;
}

export type StepUpResult = { ok: true } | { ok: false; reason: "sem_mfa" | "mfa_pendente" | "mfa_antigo" };

/** Janela da confirmação recente (step-up) para ações críticas. */
export const STEP_UP_MAX_AGE_SECONDS = 15 * 60;

/** Regra pura do step-up (testável): exige aal2 e um código TOTP confirmado há no máximo `maxAge`. */
export function evaluateStepUp(
  aal: { currentLevel: string | null; nextLevel: string | null; currentAuthenticationMethods?: (string | { method: string; timestamp: number })[] } | null,
  nowSeconds: number,
  maxAgeSeconds = STEP_UP_MAX_AGE_SECONDS,
): StepUpResult {
  if (!aal || aal.nextLevel !== "aal2") return { ok: false, reason: "sem_mfa" };
  if (aal.currentLevel !== "aal2") return { ok: false, reason: "mfa_pendente" };
  // Formato antigo (só o nome do método, sem horário) nunca conta como recente.
  const last = Math.max(0, ...(aal.currentAuthenticationMethods ?? []).flatMap((m) => (typeof m === "object" && m.method === "totp" ? [m.timestamp] : [])));
  if (!last || nowSeconds - last > maxAgeSeconds) return { ok: false, reason: "mfa_antigo" };
  return { ok: true };
}

/** Confirmação recente de MFA para ações que mudam dinheiro ou autoridade fiscal. */
export async function checkRecentStepUp(maxAgeSeconds = STEP_UP_MAX_AGE_SECONDS): Promise<StepUpResult> {
  const { data: aal } = await getAal();
  return evaluateStepUp(aal, Math.floor(Date.now() / 1000), maxAgeSeconds);
}

export const STEP_UP_MESSAGES: Record<"sem_mfa" | "mfa_pendente" | "mfa_antigo", string> = {
  sem_mfa: "Esta ação exige a verificação em duas etapas. Ative-a em Segurança e tente de novo.",
  mfa_pendente: "Confirme o código do autenticador antes desta ação.",
  mfa_antigo: "Por segurança, confirme de novo o código do autenticador (vale 15 minutos) e repita a ação.",
};

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
      .select("role, status, tenants(status)")
      .eq("tenant_id", tenantId)
      .eq("profile_id", session.userId)
      .single();

    if (!data) return null;
    const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
    // Vínculo suspenso (Fase 2) OU empresa inteira suspensa (Fase 5) - trata como sem acesso.
    if (data.status === "suspended" || tenant?.status === "suspended") return null;
    return data.role;
  },
);

/** Exige staff OU membro daquele tenant específico — redireciona senão. */
export async function requireTenantAccess(tenantId: string): Promise<Session> {
  const session = await requireSession();
  const role = await getTenantRole(tenantId);
  if (!role) redirect(session.isWjbStaff ? "/admin/empresas" : "/portal");
  return session;
}
