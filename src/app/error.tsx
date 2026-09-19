"use client";

import { useEffect } from "react";

import Link from "next/link";

import { WJBAssistant } from "@/components/assistant/WJBAssistant";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Error boundary da árvore inteira do App Router (fora do grupo `(site)`,
 * mesmo motivo do `not-found.tsx`: o boundary daqui precisa pegar erro de
 * qualquer segmento, incluindo os que nunca chegam a montar o layout do
 * grupo). Não existia nenhum `error.tsx` no projeto até agora — sem ele,
 * uma exceção não tratada caía na página de erro padrão (preta, fora do
 * Design System), a mesma lacuna que já tinha motivado o `not-found.tsx`
 * customizado.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">Erro</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Algo deu errado</h1>
        <p className="text-muted-foreground max-w-md">
          Não conseguimos carregar esta página. Tente novamente ou volte para a Home.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => retry()} className={buttonVariants({ variant: "primary" })}>
            Tentar novamente
          </button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Voltar para a Home
          </Link>
        </div>
      </Container>
      <SiteFooter />
      <WJBAssistant />
    </>
  );
}
