"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

import { Container } from "@/components/layout/container";
import { testimonials, type Testimonial } from "@/content/testimonials";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

const AUTOPLAY_INTERVAL_MS = 7000;

/** Foto do autor com fallback pras iniciais se a imagem falhar ao carregar. */
function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  const [imageError, setImageError] = useState(false);

  if (testimonial.image && !imageError) {
    return (
      <Image
        src={testimonial.image}
        alt={testimonial.name}
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
    >
      {testimonial.initials}
    </span>
  );
}

/**
 * Carrossel de depoimentos (WJB_Depoimentos_Carrossel_Claude.md, 2026-08-31).
 * Sem biblioteca de carrossel no projeto — implementado com scroll nativo
 * (`overflow-x-auto` + `scroll-snap`), que já dá swipe/touch e teclado de
 * graça, em vez de adicionar uma dependência nova (seção 5 do documento).
 * Cada dot representa um depoimento individual (não uma "página" de N
 * cards), já que o número de cards visíveis muda por breakpoint (3/2/1) —
 * assim os indicadores continuam consistentes em qualquer largura sem
 * precisar detectar breakpoint via JS.
 */
export function Testimonials() {
  const trackRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  // Enquanto true, ignora o listener de scroll — evita que a detecção por
  // posição (abaixo) sobrescreva o índice pedido explicitamente, o que
  // aconteceria perto do fim do carrossel: os últimos cards não conseguem
  // encostar na borda esquerda porque não há mais conteúdo pra rolar depois
  // deles, então o scroll fica "preso" antes do valor exato do card pedido.
  const programmaticScroll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoplayPaused = hovering || focused || hasInteracted;

  function scrollToIndex(index: number) {
    const card = cardRefs.current[index];
    const track = trackRef.current;
    if (!card || !track) return;
    if (programmaticScroll.current) clearTimeout(programmaticScroll.current);
    programmaticScroll.current = setTimeout(() => {
      programmaticScroll.current = null;
    }, 600);
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }

  function goTo(index: number) {
    const clamped = (index + testimonials.length) % testimonials.length;
    setActiveIndex(clamped);
    scrollToIndex(clamped);
  }

  function handleManualNavigation(index: number) {
    setHasInteracted(true);
    goTo(index);
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function handleScroll() {
      if (!track || programmaticScroll.current) return;
      const trackLeft = track.getBoundingClientRect().left;
      let closestIndex = 0;
      let closestDistance = Infinity;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const distance = Math.abs(card.getBoundingClientRect().left - trackLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      setActiveIndex(closestIndex);
    }

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (autoplayPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      goTo(activeIndex + 1);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, autoplayPaused]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleManualNavigation(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleManualNavigation(activeIndex - 1);
    }
  }

  return (
    <section className="border-border border-b">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Depoimentos"
          title="Quem já conta com a WJB"
          description="Experiências de clientes que contam com a WJB para cuidar da contabilidade com mais proximidade, clareza, organização e segurança."
        />

        <div
          className="relative mt-10"
          role="region"
          aria-roledescription="carrossel"
          aria-label="Depoimentos de clientes"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
        >
          {/* Sem role/aria-label aqui (2026-08-31) — um <ul> com role="region"
              perde seu role implícito "list", órfaos os <li> filhos (achado
              via Lighthouse: audit "listitem"). O landmark region + label
              foram movidos pro wrapper acima; este <ul> mantém o role nativo. */}
          <ul
            ref={trackRef}
            aria-label="Trilho de depoimentos"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={() => setHasInteracted(true)}
            className="scrollbar-hide focus-visible:ring-primary flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {testimonials.map((testimonial, index) => (
              <li
                key={testimonial.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className="border-border flex w-full shrink-0 snap-start flex-col gap-4 rounded-md border p-6 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
              >
                <Quote aria-hidden="true" className="text-primary/40 h-6 w-6" />
                <p className="text-foreground line-clamp-5 text-sm leading-relaxed">
                  {testimonial.quote}
                </p>
                <div className="border-border mt-auto flex items-center gap-3 border-t pt-4">
                  <TestimonialAvatar testimonial={testimonial} />
                  <div>
                    <p className="text-foreground text-sm font-medium">{testimonial.name}</p>
                    <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            aria-label="Depoimento anterior"
            onClick={() => handleManualNavigation(activeIndex - 1)}
            className="border-border bg-background hover:bg-muted focus-visible:ring-primary absolute top-1/2 left-0 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:flex"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próximo depoimento"
            onClick={() => handleManualNavigation(activeIndex + 1)}
            className="border-border bg-background hover:bg-muted focus-visible:ring-primary absolute top-1/2 right-0 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-md border shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:flex"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.id}
              type="button"
              aria-label={`Ir para o depoimento de ${testimonial.name}`}
              aria-current={activeIndex === index}
              onClick={() => handleManualNavigation(index)}
              className={cn(
                "focus-visible:ring-primary h-2.5 w-2.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                activeIndex === index ? "bg-primary" : "bg-muted hover:bg-border",
              )}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
