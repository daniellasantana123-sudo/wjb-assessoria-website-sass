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
        className="object-cover"
      />
      {/* 90%, não 85% (2026-08-31) — em pontos claros da foto de fundo, 85%
          deixava o texto branco abaixo de 4.5:1 (WCAG AA); 90% garante
          contraste mesmo no pior caso (área bem clara da imagem). */}
      <div className="bg-primary/90 absolute inset-0" aria-hidden="true" />
      {/*
       * Formas geométricas flutuantes (2026-09-15, mesmo pedido do Hero -
       * "antes do footer" e "na esquerda"). Sobre o overlay azul sólido,
       * então usam branco/laranja (não azul, que sumiria contra o próprio
       * fundo). Mesma lógica: atrás do Container no DOM, desfocadas, baixa
       * opacidade, decorativas.
       */}
      <div
        aria-hidden="true"
        className="anim-float-a pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="anim-float-b pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#FF6D00]/25 blur-3xl"
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
