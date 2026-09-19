import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Definir senha",
  robots: { index: false, follow: false },
};

/**
 * Destino de dois fluxos, ambos passando por `/auth/callback` antes de
 * chegar aqui: convite de usuário novo (Admin WJB cria a conta, usuário
 * define a própria senha no primeiro acesso) e recuperação de senha.
 * `requireSession` garante que só quem tem uma sessão válida (criada pelo
 * callback ao trocar o code do link de e-mail) chega até este formulário.
 */
export default async function SetPasswordPage() {
  await requireSession();

  return (
    <Container className="flex flex-1 items-center justify-center py-16">
      <div className="border-border bg-background w-full max-w-md rounded-md border p-8 shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">Definir senha</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Escolha a senha que você vai usar para acessar a plataforma da WJB.
        </p>

        <div className="mt-6">
          <SetPasswordForm />
        </div>
      </div>
    </Container>
  );
}
