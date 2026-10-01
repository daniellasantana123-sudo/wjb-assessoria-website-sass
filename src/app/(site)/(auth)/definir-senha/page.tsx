import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { FirstAccessForm } from "@/components/auth/first-access-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Definir senha",
  robots: { index: false, follow: false },
};

/**
 * Destino de dois fluxos (com `?boas-vindas=1`, o convite mostra o formulário
 * completo de primeiro acesso - nome + senha), ambos passando por `/auth/callback` antes de
 * chegar aqui: convite de usuário novo (Admin WJB cria a conta, usuário
 * define a própria senha no primeiro acesso) e recuperação de senha.
 * `requireSession` garante que só quem tem uma sessão válida (criada pelo
 * callback ao trocar o code do link de e-mail) chega até este formulário.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ "boas-vindas"?: string }>;
}) {
  const session = await requireSession();
  const { "boas-vindas": welcome } = await searchParams;

  if (welcome) {
    const help = session.isWjbStaff
      ? {
          href: "/admin/manual",
          title: "Manual da plataforma",
          description: "Como usar o Admin e o Portal, tela por tela",
        }
      : {
          href: "/ajuda",
          title: "Primeira vez por aqui? Veja o guia do Portal",
          description: "Como acompanhar prazos, enviar documentos e falar com a WJB",
        };

    return (
      <Container className="flex flex-1 items-center justify-center py-16">
        <div className="border-border bg-background w-full max-w-md rounded-md border p-8 shadow-sm">
          <h1 className="text-foreground text-2xl font-semibold">
            Boas-vindas à Plataforma WJB
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Confira seus dados e crie sua senha. Depois disso você já entra na
            plataforma.
          </p>

          <div className="mt-6">
            <FirstAccessForm
              email={session.email}
              defaultFullName={session.fullName ?? ""}
            />
          </div>

          {/*
            Guia logo no primeiro acesso (2026-10-01, pedido do usuário).
            Nova aba para não perder o que já foi digitado; <a> e não <Link>
            porque as duas rotas do manual são route handlers com documento
            próprio. Equipe WJB vê o manual da equipe (o guia do cliente não
            explica o Admin).
          */}
          <a
            href={help.href}
            target="_blank"
            rel="noopener"
            className="border-border hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-primary mt-6 flex items-center gap-3 rounded-md border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
              <BookOpen aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-sm font-medium">{help.title}</span>
              <span className="text-muted-foreground block text-xs">
                {help.description} (abre em nova aba)
              </span>
            </span>
          </a>
        </div>
      </Container>
    );
  }

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
