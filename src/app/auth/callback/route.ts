import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/db/supabase/server";
import { getSession } from "@/lib/auth/dal";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * Callback do Supabase Auth (fluxo PKCE) — todo link de e-mail (convite de
 * usuário novo, recuperação de senha) aponta pra cá com `?code=...`. Troca
 * o code por uma sessão real e decide pra onde mandar o usuário:
 * - convite/recuperação → /definir-senha (usuário ainda não tem senha
 *   utilizável, ou está trocando).
 * - qualquer outro caso → /portal ou /admin, conforme o papel.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type");

  if (!code) {
    return NextResponse.redirect(new URL("/login", getSiteUrl()));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", getSiteUrl());
    loginUrl.searchParams.set("erro", "link-invalido");
    return NextResponse.redirect(loginUrl);
  }

  if (type === "invite") {
    return NextResponse.redirect(new URL("/definir-senha?boas-vindas=1", getSiteUrl()));
  }
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/definir-senha", getSiteUrl()));
  }

  const session = await getSession();
  return NextResponse.redirect(
    new URL(session?.isWjbStaff ? "/admin" : "/portal", getSiteUrl()),
  );
}
