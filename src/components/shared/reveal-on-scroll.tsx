"use client";

import {
  Children,
  type ElementType,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/** Compartilhado por `RevealOnScroll`/`RevealStagger` — observa uma vez, nunca reobserva. */
function useRevealOnce() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      /**
       * `threshold: 0` (2026-09-20, bug real reportado pelo usuário em
       * `/conteudos` no mobile) — `RevealStagger` observa o CONTÊINER da
       * grade inteira, não cada card individualmente. Um `threshold`
       * fracionário (`0.15`) exige que aquela fração da ALTURA TOTAL do
       * contêiner esteja visível — em `/conteudos` (15 posts, 1 coluna no
       * mobile), o contêiner passa de 7000px de altura, e mesmo com a tela
       * cheia dentro dele a razão nunca chega a 15%. Resultado: `visible`
       * nunca vira `true` e a seção inteira fica com `opacity:0`
       * permanentemente — reproduzido mesmo rolando a página inteira.
       * `threshold: 0` dispara assim que 1px do contêiner entra na
       * viewport, o que não depende da altura do alvo — corrige o caso de
       * listas longas sem mudar o comportamento perceptível em seções
       * curtas (onde 0 vs. 0.15 já disparava quase no mesmo instante).
       */
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/**
 * Revela o conteúdo com fade + leve translação ao entrar na viewport.
 * Começa oculto só depois que o JS confirma que vai observar o elemento —
 * ver o <noscript> em layout.tsx, que força visibilidade sem JavaScript
 * (nunca esconder conteúdo real atrás de JS, seção 9).
 */
export function RevealOnScroll({
  children,
  className,
  as: Wrapper = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Elemento do wrapper — `"section"` quando precisa manter a semântica original. */
  as?: ElementType;
  [key: string]: unknown;
}) {
  const { ref, visible } = useRevealOnce();

  return (
    <Wrapper
      ref={ref as Ref<HTMLDivElement>}
      className={cn(
        "js-reveal transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      {...rest}
    >
      {children}
    </Wrapper>
  );
}

/**
 * Como `RevealOnScroll`, mas revela cada filho em cascata (2026-09-17, a
 * pedido do usuário — dar mais "vida" às seções da Home) em vez da seção
 * inteira aparecer como um bloco só. Pensado pra envolver diretamente o
 * `.map()` de um grid/lista (`<RevealStagger className="grid ...">{items.
 * map(...)}</RevealStagger>`) — cada filho vira um item de grid próprio,
 * então herda a mesma altura/alinhamento que teria sem o wrapper.
 * `delayStep` tem um teto (`maxDelaySteps`) pra grids grandes não demorarem
 * demais pra terminar de entrar.
 */
export function RevealStagger({
  children,
  className,
  itemClassName,
  delayStep = 70,
  maxDelaySteps = 6,
  as: Wrapper = "div",
  itemAs: Item = "div",
}: {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  delayStep?: number;
  maxDelaySteps?: number;
  /** Elemento do wrapper externo — `"ol"`/`"ul"` quando os filhos são `<li>`. */
  as?: ElementType;
  /** Elemento de cada item — `"li"` pra manter `<ol>`/`<ul>` semanticamente válidos. */
  itemAs?: ElementType;
}) {
  const { ref, visible } = useRevealOnce();

  return (
    <Wrapper ref={ref} className={className}>
      {Children.map(children, (child, index) => (
        <Item
          key={index}
          className={cn(
            "js-reveal h-full transition-all duration-700 ease-out",
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            itemClassName,
          )}
          style={{
            transitionDelay: visible
              ? `${Math.min(index, maxDelaySteps) * delayStep}ms`
              : "0ms",
          }}
        >
          {child}
        </Item>
      ))}
    </Wrapper>
  );
}
