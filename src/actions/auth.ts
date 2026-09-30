"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { getAuthCallbackUrl } from "@/lib/seo/site-url";
import { getSession } from "@/lib/auth/dal";
import {
  loginFormSchema,
  passwordResetRequestSchema,
  setPasswordSchema,
  firstAccessSchema,
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
  const next = safeNextPath(formData.get("next"));
  redirect(next ?? (session?.isWjbStaff ? "/admin" : "/portal"));
}

/**
 * Página que a pessoa tentava abrir antes de cair no login (`?next=`, posto
 * pelo proxy) - ex.: o link de uma notificação por e-mail. Só aceita caminho
 * interno do Portal/Admin: `//outro-site.com` ou uma URL absoluta
 * transformariam o login num redirecionador aberto para phishing.
 */
function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/(portal|admin)(\/|$|\?)/.test(value)) return null;
  if (value.includes("//") || value.includes("\\")) return null;
  return value;
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordResetActionState =
  { status: "error"; error: string } | { status: "success" } | undefined;

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
    redirectTo: getAuthCallbackUrl(),
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
  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (error) {
    return {
      error:
        "Não foi possível definir a senha. Peça um novo link e tente de novo.",
    };
  }

  const session = await getSession();
  redirect(session?.isWjbStaff ? "/admin" : "/portal");
}

/**
 * Primeiro acesso de quem chegou por convite (`/definir-senha?boas-vindas=1`):
 * nome + senha num formulário só, e a pessoa já entra na plataforma. O nome
 * vem pré-preenchido do convite, mas quem convidou pode ter digitado errado -
 * por isso é editável. Gravado com o client do próprio usuário: a policy
 * `profiles_update_own` permite, e o trigger da migration 0022 impede que
 * esse caminho mexa em qualquer campo de acesso.
 */
export async function completeFirstAccess(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = firstAccessSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const session = await getSession();
  if (!session) {
    return {
      error: "Seu link de acesso expirou. Peça à WJB para reenviar o convite.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
    data: { full_name: validated.data.fullName },
  });
  if (error) {
    return {
      error:
        "Não foi possível concluir seu cadastro. Peça à WJB para reenviar o convite.",
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: validated.data.fullName })
    .eq("id", session.userId);
  if (profileError) {
    // A senha já foi criada - não bloqueia a entrada por causa do nome.
    console.error("[auth] falha ao salvar nome no primeiro acesso:", profileError);
  }

  redirect(session.isWjbStaff ? "/admin" : "/portal");
}
