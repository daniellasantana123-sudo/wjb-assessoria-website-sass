import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { getSession } from "@/lib/auth/dal";
import { safeAppPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/supabase/server";

export const metadata: Metadata = {
  title: "Verificação em duas etapas",
  robots: { index: false, follow: false },
};

/**
 * Etapa de desafio de MFA no login (Fase 2 do wjb-saas-mvp, 2026-09-20).
 * Não usa `requireSession()` de propósito — essa função redireciona pra cá
 * quando o desafio ainda não foi cumprido; usar aqui causaria um loop.
 */
export default async function VerificarMfaPage({ searchParams }: PageProps<"/verificar-mfa">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  const sp = await searchParams;
  // Reconfirmação para ação crítica (step-up, Fase 10A): mostra o desafio mesmo já em aal2.
  const reconfirm = sp.reconfirmar === "1" && aal?.nextLevel === "aal2";
  const next = safeAppPath(sp.next) ?? undefined;

  // Sem fator pendente de verificação — nada a fazer aqui, segue o fluxo normal.
  if (!reconfirm && (!aal || aal.currentLevel === aal.nextLevel)) {
    redirect(session.isWjbStaff ? "/admin" : "/portal");
  }

  return (
    <Container className="flex flex-1 items-center justify-center py-16">
      <div className="border-border bg-background w-full max-w-md rounded-md border p-8 shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">Verificação em duas etapas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {reconfirm
            ? "Para concluir uma ação sensível, confirme de novo o código do seu aplicativo autenticador."
            : "Digite o código gerado pelo seu aplicativo autenticador para continuar."}
        </p>

        <div className="mt-6">
          <MfaChallengeForm next={next} />
        </div>
      </div>
    </Container>
  );
}
