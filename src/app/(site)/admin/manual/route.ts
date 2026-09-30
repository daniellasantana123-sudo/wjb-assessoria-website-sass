import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { manualResponse, readManual } from "@/lib/manual";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * Manual completo da plataforma, só para a equipe WJB (explica o Admin, as
 * permissões e o G-Click - não é para clientes; a versão deles é /ajuda).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?next=/admin/manual", getSiteUrl()));
  }
  if (!session.isWjbStaff) {
    return NextResponse.redirect(new URL("/portal", getSiteUrl()));
  }
  return manualResponse(readManual("manual-equipe.html"), "private, no-store");
}
