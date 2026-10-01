import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { homeImages } from "@/config/images";
import { headerCtas } from "@/config/navigation";

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden">
      <Image
        src={homeImages.finalCta.src}
        alt=""
        fill
        sizes="100vw"
        // Faixa bem mais larga que a foto: o corte prioriza os rostos (terço
        // de cima) em vez do centro, que mostrava mais mesa que gente.
        className="object-cover object-[center_28%]"
      />
      {/*
       * Camada azul em degradê (2026-10-01, pedido do usuário: foto
       * aparecendo na faixa toda, sem o laranja do canto). Mais forte no
       * centro, atrás do texto - mantém o contraste do branco acima do
       * mínimo WCAG AA - e mais leve nas bordas, onde a foto aparece mais.
       * A forma laranja desfocada do canto esquerdo foi removida.
       */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_50%_50%,rgb(25_67_130/0.93)_0%,rgb(25_67_130/0.9)_45%,rgb(25_67_130/0.74)_100%)]"
      />
      <Container className="text-primary-foreground relative flex flex-col items-center gap-6 py-16 text-center sm:py-20">
        <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
          Pronto para ter uma contabilidade mais próxima?
        </h2>
        <p className="max-w-xl text-white">
          Fale com um contador da WJB e entenda como podemos ajudar sua empresa.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={headerCtas.talkToAccountant.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "cta", size: "lg" })}
          >
            {headerCtas.talkToAccountant.label}
          </Link>
          <Link
            href={headerCtas.requestProposal.href}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "border-white text-white hover:bg-white/10",
            })}
          >
            {headerCtas.requestProposal.label}
          </Link>
        </div>
      </Container>
    </section>
  );
}
