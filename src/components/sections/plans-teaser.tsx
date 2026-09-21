import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { headerCtas } from "@/config/navigation";
import { formatBRL } from "@/config/pricing";
import { plans } from "@/config/plans";
import { cn, navigableCardClass } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

/**
 * Seção "Encontre o plano ideal" (WJB_Planos_Simulador_Implementacao_
 * Claude.md, seção 38) — cards compactos com os preços de entrada reais dos
 * 3 planos, substituindo a versão anterior sem valores (que existia
 * enquanto os planos eram "Sob consulta").
 */
export function PlansTeaser() {
  return (
    <section className="border-border border-b">
      <Container className="flex flex-col items-center gap-10 py-16 text-center sm:py-20">
        <SectionHeading
          eyebrow="PLANOS MENSAIS"
          title="Encontre o plano ideal para sua empresa."
        />
        {/*
         * Cards com conteúdo real (2026-09-17, a pedido do usuário —
         * "layout/composição das seções"): antes só mostravam nome + preço
         * (2 linhas); `cardSummary`/`cardHighlights` já existem em
         * `src/config/plans.ts` (mesmo texto real e aprovado usado nas
         * páginas de detalhe), só não eram reaproveitados aqui. Nenhum
         * rótulo tipo "mais popular" — seria uma afirmação de fato sem
         * dado real (seção 43), diferente de mostrar conteúdo que já existe.
         */}
        <RevealStagger className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={plan.detailsPath}
              className={cn(navigableCardClass, "group flex h-full flex-col gap-4 p-6 text-left")}
            >
              <div>
                <p className="text-foreground text-lg font-semibold">{plan.name}</p>
                <p className="text-primary mt-1 text-sm font-medium">
                  A partir de {formatBRL(plan.startingPrice)}/mês
                </p>
              </div>
              <p className="text-muted-foreground text-sm">{plan.cardSummary}</p>
              <ul className="mt-auto flex flex-col gap-2">
                {plan.cardHighlights.slice(0, 3).map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-primary mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span className="text-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </RevealStagger>
        <Link
          href={headerCtas.talkToAccountant.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "cta" })}
        >
          Fale com a nossa equipe
        </Link>
      </Container>
    </section>
  );
}
