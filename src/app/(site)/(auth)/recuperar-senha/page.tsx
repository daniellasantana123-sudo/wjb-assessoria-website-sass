import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Solicite a redefinição da sua senha de acesso à plataforma WJB.",
};

export default function PasswordResetPage() {
  return (
    <Container className="flex flex-1 items-center justify-center py-16">
      <div className="border-border bg-background w-full max-w-md rounded-md border p-8 shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">Recuperar senha</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
        </p>

        <div className="mt-6">
          <PasswordResetForm />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link
            href="/login"
            className="hover:text-primary focus-visible:ring-primary text-foreground rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Voltar para o login
          </Link>
        </p>
      </div>
    </Container>
  );
}
