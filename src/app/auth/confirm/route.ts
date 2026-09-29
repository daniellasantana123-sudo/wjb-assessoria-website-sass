import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/db/supabase/server";
import { getSession } from "@/lib/auth/dal";
import { getSiteUrl } from "@/lib/seo/site-url";

const ACCEPTED_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email"];

/**
 * Destino dos links de e-mail do Supabase Auth (convite e recuperação de
 * senha), no formato `?token_hash=...&type=...` - os templates do painel
 * do Supabase apontam pra cá (ver `docs/api/integrations.md`).
 *
 * Existe porque `/auth/callback` não atende convites: `inviteUserByEmail`
 * roda com a service role, sem fluxo PKCE, e o link padrão devolve a
 * sessão no fragmento da URL (`#access_token=...`), que nunca chega ao
 * servidor - o convidado caía no login sem sessão e sem conseguir criar
 * senha. Com `token_hash`, a validação é feita aqui, no servidor, e não
 * depende do navegador que pediu o link (funciona também quando a pessoa
 * abre o e-mail em outro aparelho).
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !ACCEPTED_TYPES.includes(type)) {
    return invalidLink();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error("[auth/confirm] link rejeitado:", error.message);
    return invalidLink();
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

function invalidLink() {
  const loginUrl = new URL("/login", getSiteUrl());
  loginUrl.searchParams.set("erro", "link-invalido");
  return NextResponse.redirect(loginUrl);
}
