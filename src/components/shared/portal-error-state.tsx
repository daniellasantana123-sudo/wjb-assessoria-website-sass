"use client";

import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button";

/**
 * Error boundary compartilhado por rotas do Portal (Fase 3 do wjb-saas-mvp,
 * 2026-09-20) — diferente do `error.tsx` raiz (`src/app/error.tsx`), não
 * renderiza header/footer/assistente de marketing: a sidebar do Portal
 * (`portal/layout.tsx`) já continua montada por fora deste boundary, então
 * só o conteúdo da rota precisa de um estado de erro próprio.
 */
export function PortalErrorState({
  error,
  retry,
  message = "Não conseguimos carregar esta página. Tente novamente.",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  message?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-border bg-muted/30 flex flex-col items-center gap-4 rounded-md border p-10 text-center">
      <p className="text-foreground font-medium">Algo deu errado</p>
      <p className="text-muted-foreground max-w-md text-sm">{message}</p>
      <button
        type="button"
        onClick={() => retry()}
        className={buttonVariants({ variant: "outline" })}
      >
        Tentar novamente
      </button>
    </div>
  );
}
