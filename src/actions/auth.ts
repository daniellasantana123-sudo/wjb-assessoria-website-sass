"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { getSession } from "@/lib/auth/dal";
import {
  loginFormSchema,
  passwordResetRequestSchema,
  setPasswordSchema,
  type LoginFormValues,
  type PasswordResetRequestValues,
  type SetPasswordValues,
} from "@/lib/validation/auth";

/**
 * Contas são provisionadas pelo time WJB no onboarding (Admin WJB, SAAS
 * FASE 4 — "Empresas"/"Usuários") — por isso não existe Server Action de
 * autocadastro aqui, só login/logout/recuperação de senha. Cliente recebe
 * o convite por e-mail (SAAS FASE 5 — integração de e-mail) e define a
 * própria senha no primeiro acesso.
 */

export type AuthActionState = { error: string } | undefined;

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw: LoginFormValues = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const validated = loginFormSchema.safeParse(raw);
  if (!validated.success) {
    return { error: "E-mail ou senha inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validated.data);

  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  const session = await getSession();
  redirect(session?.isWjbStaff ? "/admin" : "/portal");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordResetActionState =
  | { status: "error"; error: string }
  | { status: "success" }
  | undefined;

export async function requestPasswordReset(
  _prevState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  const raw: PasswordResetRequestValues = {
    email: String(formData.get("email") ?? ""),
  };

  const validated = passwordResetRequestSchema.safeParse(raw);
  if (!validated.success) {
    return { status: "error", error: "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  // Não revela se o e-mail existe ou não — sempre a mesma mensagem de sucesso
  // no formulário, evitando enumeração de contas cadastradas.
  await supabase.auth.resetPasswordForEmail(validated.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  });

  return { status: "success" };
}

export async function setPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw: SetPasswordValues = {
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const validated = setPasswordSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: validated.data.password });

  if (error) {
    return { error: "Não foi possível definir a senha. Peça um novo link e tente de novo." };
  }

  const session = await getSession();
  redirect(session?.isWjbStaff ? "/admin" : "/portal");
}
