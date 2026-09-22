"use client";

import Image from "next/image";
import Link from "next/link";
import Fade from "embla-carousel-fade";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PenLine,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { homeImages } from "@/config/images";
import { headerCtas } from "@/config/navigation";

/**
 * Instanciado uma vez, fora do componente (2026-09-17) — `Fade()` devolve
 * um objeto com funções (`init`/`destroy`), que o React Server Components
 * rejeita cruzar a fronteira servidor->cliente ("Functions cannot be
 * passed directly to Client Components"). Isso forçou `Hero` a virar
 * Client Component (antes era Server Component puro, sem necessidade de
 * `"use client"` até agora) — sem isso, `<Carousel plugins={[Fade()]} />`
 * quebra com esse erro real (confirmado no log do dev server) assim que a
 * seção tenta renderizar, mesmo se `Fade()` fosse criado dentro do próprio
 * `Hero`.
 */
const heroCarouselPlugins = [Fade()];

interface HeroSlideBadge {
  icon: LucideIcon;
  status: string;
  category: string;
}

/**
 * Selos flutuantes sobre cada foto do carrossel (2026-09-22, a pedido do
 * usuário, inspirado num mockup de referência com um selo escuro "Video
 * consultation in progress" + um cartão claro "Dr. X · Especialidade").
 * Adaptado pro contexto real da WJB em vez de replicar o texto do mockup
 * (uma consulta médica, sem relação com contabilidade): o texto de status
 * descreve a cena de cada foto (parafraseado do `alt` já real de cada
 * slide, ver `homeImages.heroSlides` em `config/images.ts`) e a categoria
 * reaproveita as 5 categorias reais de `service-pages.ts` - nunca o nome
 * de uma pessoa, porque as fotos são still de banco de imagens e não
 * retratam nenhum funcionário real da WJB (`docs/design/images.md`);
 * atribuir um nome a elas seria inventar uma identidade (seção 43 do
 * documento do projeto). `heroSlideBadges[i]` corresponde a
 * `homeImages.heroSlides[i]` pela posição no array.
 */
const heroSlideBadges: HeroSlideBadge[] = [
  { icon: Search, status: "Diagnóstico em andamento", category: "Consultoria" },
  {
    icon: Receipt,
    status: "Apuração de impostos",
    category: "Fiscal e Tributário",
  },
  {
    icon: ClipboardCheck,
    status: "Regularização em dia",
    category: "Societário e Legalização",
  },
  {
    icon: FileText,
    status: "Revisão de documentos",
    category: "Contabilidade",
  },
  {
    icon: Building2,
    status: "Estrutura societária",
    category: "Societário e Legalização",
  },
  {
    icon: BarChart3,
    status: "Planejamento e resultados",
    category: "Consultoria",
  },
  {
    icon: Wallet,
    status: "Folha de pagamento",
    category: "Departamento Pessoal",
  },
  {
    icon: TrendingUp,
    status: "Planejamento tributário",
    category: "Fiscal e Tributário",
  },
  {
    icon: PenLine,
    status: "Abertura de empresa",
    category: "Societário e Legalização",
  },
];

export function Hero() {
  return (
    <section className="border-border relative overflow-hidden border-b">
      {/*
       * Formas geométricas flutuantes (2026-09-15, a pedido do usuário —
       * "pensar como um especialista UI/UX", sem poluir a seção). Dois
       * círculos grandes, bem desfocados e em opacidade baixa - ficam
       * atrás de todo o conteúdo (antes do `Container` no DOM),
       * `pointer-events-none` pra nunca interceptar clique/toque, e
       * `aria-hidden` por serem puramente decorativas. `overflow-hidden`
       * na section evita que o desfoque/posicionamento negativo cause
       * overflow horizontal. O segundo círculo era laranja (cor do
       * logotipo); trocado pra cinza claro em 2026-09-17, a pedido do
       * usuário.
       */}
      <div
        aria-hidden="true"
        className="anim-float-a bg-brand-blue-300/25 pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="anim-float-b bg-neutral-300/30 pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full blur-3xl"
      />
      <Container className="relative grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-12 lg:py-24">
        <div className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
          <h1 className="anim-fade-up font-noto-sans-thai max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-primary">Sua empresa cresce melhor</span>{" "}
            <span className="text-foreground">
              quando você entende os números.
            </span>
          </h1>
          {/*
           * Entrada orquestrada (2026-09-17, a pedido do usuário —
           * "animações no site", pensando como especialista de UX/UI):
           * parágrafo, CTAs e o link "Já sou cliente" reusam a mesma
           * `anim-fade-up` do H1 (ver globals.css), só que atrasada em
           * incrementos de 120ms — em vez de aparecerem todos de uma vez
           * junto com o H1, entram em sequência logo atrás dele.
           */}
          <p className="anim-fade-up text-muted-foreground max-w-xl text-lg [animation-delay:120ms]">
            Contabilidade consultiva, atendimento próximo e tecnologia para
            manter sua empresa organizada, segura e pronta para crescer.
          </p>
          <div className="anim-fade-up flex flex-wrap items-center justify-center gap-3 [animation-delay:240ms] lg:justify-start">
            <Link
              href={headerCtas.talkToAccountant.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "cta", size: "lg" })}
            >
              Falar com um contador
            </Link>
            <Link
              href="/servicos"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Conhecer nossos serviços
            </Link>
          </div>
          <Link
            href="/area-do-cliente"
            className="anim-fade-up hover:text-primary focus-visible:ring-primary text-foreground rounded-md text-sm font-medium underline underline-offset-4 [animation-delay:340ms] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Já sou cliente → Área do Cliente
          </Link>
        </div>

        {/*
         * Transição em fade (2026-09-17, a pedido do usuário — trocar a
         * animação do carrossel). `embla-carousel-fade`, plugin oficial do
         * Embla (já usado via `embla-carousel-react`) — cross-fade entre
         * fotos em vez do deslizar lateral padrão; dependência nova
         * pequena e propósito único, mesmo racional de adicionar o
         * `resend` quando um provider real foi escolhido.
         */}
        <Carousel
          opts={{ loop: true }}
          plugins={heroCarouselPlugins}
          className="w-full"
        >
          <CarouselContent className="ml-0">
            {homeImages.heroSlides.map((slide, index) => {
              const badge = heroSlideBadges[index];
              return (
                <CarouselItem key={slide.src} className="pl-0">
                  {/* aspect-square (2026-09-14) — fotos são 1254x1254 (1:1), confirmado pelo usuário. */}
                  <div className="group relative aspect-square w-full overflow-hidden rounded-[10px]">
                    {/*
                     * `unoptimized` (2026-09-14) — pedido explícito do
                     * usuário pras fotos do carrossel: "formato original e
                     * qualidade original". Sem isso, o otimizador de imagens
                     * do Next recomprimiria o PNG pra webp na hora de servir
                     * (mesmo comportamento documentado na tarefa "aumente a
                     * resolução" - ver docs/design/images.md), o que
                     * silenciosamente desfaria o pedido. Com `unoptimized`,
                     * o arquivo é entregue como está, sem reprocessamento -
                     * a troca é não ter redimensionamento responsivo
                     * automático (arquivos maiores, ~5.5MB cada).
                     *
                     * `group-hover:scale-105` (2026-09-17) — zoom suave no
                     * hover, contido pelo `overflow-hidden` do pai. O plugin
                     * `Fade()` marca slides inativos com `pointer-events:
                     * none` (ver hero.tsx acima), então só o slide realmente
                     * visível reage ao hover do mouse.
                     */}
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      unoptimized
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    {/*
                     * Gradiente preto (2026-09-17, a pedido do usuário —
                     * voltar do laranja pro preto; o laranja tinha sido pedido
                     * em 2026-09-15). Ancorado embaixo, opaco -> transparente,
                     * sem escurecer o rosto das pessoas (fica concentrado na
                     * base da foto). `pointer-events-none` pra não interceptar
                     * clique nas setas do carrossel; `aria-hidden` por ser
                     * puramente decorativo.
                     */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 via-40% to-transparent"
                    />
                    {/*
                     * Selos flutuantes (2026-09-22, ver `heroSlideBadges`
                     * acima) - escondidos por padrão (`opacity-0` +
                     * `translate-y-1`) e revelados só no hover do slide ativo
                     * via `group-hover`, mesmo gatilho já usado pro zoom da
                     * foto. `pointer-events-none` (não são clicáveis, e não
                     * podem interceptar o clique nas setas) + `aria-hidden`
                     * (decorativo, o conteúdo real da foto já está no `alt`).
                     * O selo de baixo tem um delay levemente maior
                     * (`delay-100` vs sem delay) pra entrar logo depois do de
                     * cima, em vez dos dois aparecerem exatamente juntos.
                     *
                     * `pointer-coarse:` (2026-09-22, achado testando
                     * responsivo/mobile) - `:hover` via `group-hover`
                     * depende de um ponteiro capaz de pairar sem clicar
                     * (mouse); em celular/tablet não existe isso - tocar na
                     * tela não é "hover" de verdade, então sem esse ajuste
                     * os selos nunca apareceriam pra quem visita pelo
                     * celular (maioria do tráfego de um site institucional).
                     * `pointer-coarse:` (variante nativa do Tailwind pra
                     * `@media (pointer: coarse)`, que cobre telas de toque)
                     * força os selos sempre visíveis nesses dispositivos, em
                     * vez de depender de um hover que não existe lá.
                     */}
                    {badge ? (
                      <>
                        <div
                          aria-hidden="true"
                          className="pointer-coarse:translate-y-0 pointer-coarse:opacity-100 pointer-events-none absolute top-3 left-3 flex max-w-[85%] translate-y-1 items-center gap-1.5 rounded-full bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
                        >
                          <badge.icon
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          <span className="truncate">{badge.status}</span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="pointer-coarse:translate-y-0 pointer-coarse:opacity-100 pointer-events-none absolute right-3 bottom-3 flex max-w-[85%] translate-y-1 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-900 opacity-0 shadow-lg transition-all delay-100 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
                        >
                          <CheckCircle2
                            aria-hidden="true"
                            className="text-success h-3.5 w-3.5 shrink-0"
                          />
                          <span className="truncate">
                            {badge.category} · WJB
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </Container>
    </section>
  );
}
