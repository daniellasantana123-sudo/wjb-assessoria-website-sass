import Link from "next/link";

import { WJBAssistant } from "@/components/assistant/WJBAssistant";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * Fora do grupo `(site)` de propósito — o boundary global de 404 do Next
 * precisa ficar na raiz de `app/` pra pegar qualquer rota que não bateu em
 * nenhum segmento (o layout do grupo nunca chega a rodar nesse caso). Por
 * isso importa o header/footer de marketing direto, em vez de herdar de
 * `(site)/layout.tsx`.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">404</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground max-w-md">
          A página que você procura não existe ou foi movida.
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Voltar para a Home
        </Link>
      </Container>
      <SiteFooter />
      <WJBAssistant />
    </>
  );
}
