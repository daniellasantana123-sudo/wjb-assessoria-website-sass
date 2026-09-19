import Link from "next/link";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { cn, staticCardHoverClass } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

const steps = [
  {
    step: "1",
    title: "Diagnóstico",
    description: "Entendemos sua empresa, seu momento e o que você precisa resolver.",
  },
  {
    step: "2",
    title: "Proposta e onboarding",
    description: "Alinhamos escopo e organizamos a transição, sem burocracia para você.",
  },
  {
    step: "3",
    title: "Rotina contábil",
    description: "Cuidamos da execução mensal - fiscal, contábil e pessoal.",
  },
  {
    step: "4",
    title: "Acompanhamento",
    description: "Você acompanha os números e conta com a gente para decidir.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-border bg-muted/30 border-b">
      <Container className="py-16 sm:py-20">
        <SectionHeading eyebrow="Como funciona" title="Como é trabalhar com a WJB" />
        {/*
         * Linha conectora (2026-09-17, a pedido do usuário —
         * "layout/composição das seções"): antes os 4 passos eram um grid
         * de card igual a qualquer outro grid do site, sem comunicar
         * visualmente que é uma sequência. Um traço horizontal atrás dos
         * cards, na altura do círculo numerado — visível só a partir de
         * `lg` (onde os 4 ficam numa linha só; empilhado em telas menores a
         * ordem de leitura já é linear por natureza). `border-primary/40`
         * (2px) em vez de `border-border`: testado ao vivo no navegador com
         * `border-border` (1px, cinza neutro) e ficou sutil demais pra
         * perceber sem inspecionar o DOM — cor da marca resolve isso. Os
         * cards ficam `relative z-10` com fundo opaco por cima, então a
         * linha só aparece nos vãos entre eles — padrão comum de seção
         * "como funciona" (Stripe, Linear etc.).
         */}
        <div className="relative mx-auto mt-10 max-w-4xl">
          <div
            aria-hidden="true"
            className="border-primary/40 absolute inset-x-[12.5%] top-9 hidden border-t-2 lg:block"
          />
          <RevealStagger
            as="ol"
            itemAs="li"
            className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            itemClassName="h-full"
          >
            {steps.map((item) => (
              <div
                key={item.step}
                className={cn(
                  staticCardHoverClass,
                  "border-border bg-background relative z-10 flex h-full flex-col items-center gap-2 rounded-md border p-5 text-center",
                )}
              >
                <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                  {item.step}
                </span>
                <h3 className="text-foreground mt-1 font-medium">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            ))}
          </RevealStagger>
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/como-funciona" className={buttonVariants({ variant: "outline" })}>
            Ver todos os detalhes
          </Link>
        </div>
      </Container>
    </section>
  );
}
