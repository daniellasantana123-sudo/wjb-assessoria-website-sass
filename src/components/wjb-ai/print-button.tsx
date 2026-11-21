"use client";

import { Button } from "@/components/ui/button";

/** Abre a impressão do navegador (salvar como PDF). Nenhum arquivo é gerado no servidor. */
export function PrintButton({
  label = "Imprimir ou salvar em PDF",
}: {
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="print:hidden"
    >
      {label}
    </Button>
  );
}
