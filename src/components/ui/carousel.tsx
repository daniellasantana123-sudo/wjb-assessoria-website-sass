"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";

import { cn } from "@/lib/utils";

/**
 * Wrapper fino sobre `embla-carousel-react` (2026-09-14, a pedido do
 * usuário — "npm dlx shadcn@latest add carousel"). Mesma API pública do
 * componente carousel do shadcn/ui (Carousel/CarouselContent/CarouselItem/
 * CarouselPrevious/CarouselNext/useCarousel), reimplementada à mão contra
 * o `cn()` e o `Design System` já existentes deste projeto em vez de
 * depender do CLI do shadcn — rodar o CLI de verdade tentou inicializar um
 * sistema de tema/Button paralelo (Base UI + class-variance-authority +
 * variáveis OKLCH) que colidia com a "Paleta Vívida" já estabelecida
 * (mesmos nomes de variável, ex. `--background`/`--primary`, com valores
 * incompatíveis) e substituiria o `Button` usado em ~20 arquivos do site.
 * Setas de navegação com `rounded-[4px]` (pedido explícito do usuário, em
 * vez do `rounded-full` padrão do shadcn).
 */
type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel deve ser usado dentro de um <Carousel />");
  }

  return context;
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );

  /**
   * `useSyncExternalStore` em vez de `useState`+`useEffect` (mesmo padrão
   * já usado no projeto pra CookieConsentBanner/PricingSimulator) — ler
   * `canScrollPrev()`/`canScrollNext()` direto do embla e assinar
   * `on("select"/"reInit")` evita o setState síncrono no corpo do efeito
   * que o lint `react-hooks/set-state-in-effect` rejeita, e ainda
   * sincroniza o estado inicial corretamente (o problema que motivava a
   * chamada eager de `onSelect` no código original do shadcn).
   */
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange);
      api.on("reInit", onChange);
      return () => {
        api.off("select", onChange);
        api.off("reInit", onChange);
      };
    },
    [api],
  );
  const canScrollPrev = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollPrev() ?? false,
    () => false,
  );
  const canScrollNext = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollNext() ?? false,
    () => false,
  );

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) return;
    setApi(api);
  }, [api, setApi]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        opts,
        orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carrossel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = useCarousel();

  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
}

/** Classe compartilhada das setas — quadrada, 4px de raio (pedido explícito do usuário). */
const navButtonClass =
  "border-border bg-background text-foreground hover:bg-muted focus-visible:ring-primary flex h-9 w-9 items-center justify-center rounded-[4px] border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

function CarouselPrevious({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <button
      type="button"
      aria-label="Slide anterior"
      className={cn(
        navButtonClass,
        "absolute touch-manipulation",
        orientation === "horizontal"
          ? "top-1/2 left-2 -translate-y-1/2 sm:left-3"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function CarouselNext({ className, ...props }: React.ComponentProps<"button">) {
  const { orientation, scrollNext, canScrollNext } = useCarousel();

  return (
    <button
      type="button"
      aria-label="Próximo slide"
      className={cn(
        navButtonClass,
        "absolute touch-manipulation",
        orientation === "horizontal"
          ? "top-1/2 right-2 -translate-y-1/2 sm:right-3"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRight aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  useCarousel,
};
