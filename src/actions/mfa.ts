"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { getSession, requireSession } from "@/lib/auth/dal";

/**
 * MFA (Fase 2 do wjb-saas-mvp, 2026-09-20) — "preparar a estrutura": TOTP
 * disponível pra qualquer usuário (staff ou cliente) ativar por conta
 * própria, sem exigir de ninguém. Usa `supabase.auth.mfa.*` direto (API
 * nativa do Supabase Auth, sem tabela/provider próprio) — verificado contra
 * os tipos reais de `@supabase/auth-js` antes de escrever este arquivo,
 * não por lembrança da documentação.
 */

export interface MfaFactorSummary {
  id: string;
  status: "verified" | "unverified";
  createdAt: string;
}

export async function listTotpFactors(): Promise<MfaFactorSummary[]> {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();

  return (data?.all ?? [])
    .filter((factor) => factor.factor_type === "totp")
    .map((factor) => ({
      id: factor.id,
      status: factor.status,
      createdAt: factor.created_at,
    }));
}

export type MfaEnrollState =
  | { status: "error"; error: string }
  | { status: "enrolled"; factorId: string; qrCode: string; secret: string }
  | undefined;

export async function enrollTotpFactor(): Promise<MfaEnrollState> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });

  if (error || !data) {
    return {
      status: "error",
      error: "Não foi possível iniciar a configuração. Tente novamente.",
    };
  }

  return {
    status: "enrolled",
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export type MfaVerifyState = { error: string } | { success: true } | undefined;

/** `factorId` vem via `.bind(null, factorId)` no `<form action>` — não é input do usuário. */
export async function verifyTotpEnrollment(
  factorId: string,
  _prevState: MfaVerifyState,
  formData: FormData,
): Promise<MfaVerifyState> {
  await requireSession();
  const code = String(formData.get("code") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return {
      error: "Digite o código de 6 dígitos do aplicativo autenticador.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (error) {
    return { error: "Código inválido ou expirado. Tente de novo." };
  }

  revalidatePath("/portal/seguranca");
  revalidatePath("/admin/seguranca");
  return { success: true };
}

export async function unenrollTotpFactor(factorId: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.auth.mfa.unenroll({ factorId });
  revalidatePath("/portal/seguranca");
  revalidatePath("/admin/seguranca");
}

export type MfaChallengeState = { error: string } | undefined;

/** Desafio de MFA no login (step-up) — chamado só por `/verificar-mfa`. */
export async function verifyLoginMfaChallenge(
  _prevState: MfaChallengeState,
  formData: FormData,
): Promise<MfaChallengeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { error: "Digite o código de 6 dígitos." };
  }

  const supabase = await createClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factor = factorsData?.totp?.[0];

  if (!factor) {
    // Sem fator verificado — não deveria chegar aqui, mas não trava o usuário.
    redirect(session.isWjbStaff ? "/admin" : "/portal");
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });

  if (error) {
    return { error: "Código inválido ou expirado. Tente de novo." };
  }

  redirect(session.isWjbStaff ? "/admin" : "/portal");
}
