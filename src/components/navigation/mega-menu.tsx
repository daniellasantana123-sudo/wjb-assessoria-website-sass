"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import { useDisclosure } from "@/hooks/use-disclosure";
import { cn } from "@/lib/utils";
import { headerCtas } from "@/config/navigation";
import { servicePages } from "@/config/service-pages";
import { servicesMenuPromoImage } from "@/config/images";

/**
 * Duas linhas em vez de uma única grade de 5 categorias (2026-08-31, a
 * pedido do usuário): Fiscal e Tributário/Societário e Legalização (4
 * serviços cada) ficavam bem mais altas que Contabilidade/Departamento
 * Pessoal/Consultoria (1 serviço cada), deixando um espaço vazio grande
 * embaixo das categorias curtas — a descrição por categoria (ver
 * `categoryDescriptions`) ajudou, mas não resolvia a diferença de altura.
 * Agrupar categorias de tamanho parecido na mesma linha resolve de vez:
 * `primaryCategoryOrder` (as 2 categorias longas + a imagem, altura
 * parecida) e `secondaryCategoryOrder` (as 3 curtas, todas baixas, sem
 * vizinha alta pra sobrar espaço).
 */
const primaryCategoryOrder = ["Fiscal e Tributário", "Societário e Legalização"];
const secondaryCategoryOrder = ["Contabilidade", "Departamento Pessoal", "Consultoria"];

/**
 * Descrição curta por categoria (2026-08-31, a pedido do usuário) — categorias
 * com só 1 serviço (Contabilidade, Departamento Pessoal, Consultoria) ficavam
 * com muito espaço vazio abaixo do link, ao lado de categorias com 4 (Fiscal
 * e Tributário, Societário e Legalização). Em vez de preencher com uma foto
 * decorativa (sem razão de navegação, ao contrário do espaço da seção 6),
 * cada categoria ganhou uma linha de contexto — reduz a sensação de "vazio"
 * com conteúdo real, não enchimento visual.
 */
const categoryDescriptions: Record<string, string> = {
  Contabilidade: "Escrituração contábil completa da sua empresa.",
  "Fiscal e Tributário": "Apuração de tributos, planejamento e obrigações fiscais.",
  "Departamento Pessoal": "Folha de pagamento, admissões e obrigações trabalhistas.",
  "Societário e Legalização": "Abertura, alterações e regularização da empresa.",
  Consultoria: "Orientação contábil e tributária para decisões mais seguras.",
};

function buildCategories(order: string[]) {
  return order
    .map((category) => ({
      category,
      items: servicePages.filter((service) => service.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

const primaryCategories = buildCategories(primaryCategoryOrder);
const secondaryCategories = buildCategories(secondaryCategoryOrder);

function CategoryColumn({
  group,
  onNavigate,
}: {
  group: { category: string; items: (typeof servicePages)[number][] };
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {group.category}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {categoryDescriptions[group.category]}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {group.items.map((service) => (
          <li key={service.slug}>
            <Link
              href={`/servicos/${service.slug}`}
              onClick={onNavigate}
              className="hover:text-primary focus-visible:ring-primary text-foreground flex items-center gap-2 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Check aria-hidden="true" className="text-primary h-3.5 w-3.5 shrink-0" />
              {service.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MegaMenu() {
  const { open, setOpen, rootRef } = useDisclosure();

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="mega-menu-servicos"
        onClick={() => setOpen(true)}
        className="hover:text-primary focus-visible:ring-primary text-foreground flex items-center gap-1 rounded-md text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Serviços
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <>
          {/* Ponte invisível — sem ela, o gap entre o botão e o painel faz o
              mouse "sair" do dropdown (mouseleave) antes de alcançar o
              painel, fechando o menu antes do usuário conseguir clicar num
              item. */}
          <div className="absolute inset-x-0 top-full h-3" aria-hidden="true" />
          <div
            id="mega-menu-servicos"
            className="animate-enter border-border bg-background absolute top-full left-0 z-40 mt-3 w-[640px] max-w-[90vw] rounded-md border p-6 shadow-lg"
          >
            <div className="grid grid-cols-3 gap-6">
              {primaryCategories.map((group) => (
                <CategoryColumn
                  key={group.category}
                  group={group}
                  onNavigate={() => setOpen(false)}
                />
              ))}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[10px]">
                  <Image
                    src={servicesMenuPromoImage.src}
                    alt={servicesMenuPromoImage.alt}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    Não sabe por onde começar?
                  </p>
                  <Link
                    href={headerCtas.talkToAccountant.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="text-cta-text text-sm font-medium hover:underline"
                  >
                    Fale com um contador →
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-border mt-6 grid grid-cols-3 gap-6 border-t pt-6">
              {secondaryCategories.map((group) => (
                <CategoryColumn
                  key={group.category}
                  group={group}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
            <div className="border-border mt-6 border-t pt-4">
              <Link
                href="/servicos"
                onClick={() => setOpen(false)}
                className="text-primary text-sm font-medium hover:underline"
              >
                Ver todos os serviços →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
