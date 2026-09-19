"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Único boundary que pega erro no próprio `layout.tsx` raiz (`error.tsx`
 * não cobre esse caso — não envolve o layout do mesmo segmento). Precisa
 * declarar `<html>`/`<body>` própria e não pode usar `metadata`/hooks que
 * dependam de contexto de outros componentes (header, banner de cookies
 * etc. não rodam aqui) — por isso é uma página autocontida, sem reusar
 * `SiteHeader`/`SiteFooter`, só o `globals.css` pra manter a marca.
 */
export default function GlobalError({
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
    <html lang="pt-BR" className="h-full antialiased">
      <body className="bg-background text-foreground flex min-h-full flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">Erro</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Algo deu errado</h1>
        <p className="text-muted-foreground max-w-md">
          Ocorreu um erro inesperado ao carregar o site. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="bg-primary text-primary-foreground hover:bg-brand-blue-700 focus-visible:ring-primary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
