import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Entrar",
  description: "Acesse o Portal do Cliente ou a área interna da WJB Assessoria Contábil.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;

  return (
    <Container className="flex flex-1 items-center justify-center py-16">
      <div className="border-border bg-background w-full max-w-md rounded-md border p-8 shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">Entrar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Acesse com o e-mail e senha cadastrados pela WJB.
        </p>

        {erro === "link-invalido" ? (
          <p
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger mt-6 rounded-md border p-3 text-sm"
          >
            Esse link de acesso expirou ou já foi usado. Use &quot;Esqueci minha
            senha&quot; abaixo para receber um novo, ou peça à WJB para reenviar o
            convite.
          </p>
        ) : null}

        <div className="mt-6">
          <LoginForm next={next} />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Ainda não tem acesso?{" "}
          <Link
            href="/contato"
            className="hover:text-primary focus-visible:ring-primary text-foreground rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Fale com a WJB
          </Link>
        </p>
      </div>
    </Container>
  );
}
