import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowRightLeft, Building2, Compass, UserCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { homeImages } from "@/config/images";
import { cn, navigableCardClass } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

const needs = [
  {
    title: "Quero abrir uma empresa",
    description: "Do zero, com orientação sobre regime tributário e legalização.",
    href: "/servicos/abrir-empresa",
    icon: Building2,
  },
  {
    title: "Quero trocar de contador",
    description: "Transição conduzida pela WJB, sem burocracia para você.",
    href: "/servicos/trocar-de-contador",
    icon: ArrowRightLeft,
  },
  {
    title: "Preciso de consultoria",
    description: "Diagnóstico contábil, fiscal e tributário para decidir melhor.",
    href: "/servicos/consultoria-contabil",
    icon: Compass,
  },
  {
    title: "Já sou cliente",
    description: "Acesse a Área do Cliente para acompanhar sua empresa.",
    href: "/area-do-cliente",
    icon: UserCheck,
  },
];

export function NeedsPicker() {
  return (
    <section className="border-border border-b">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
            <Image
              src={homeImages.businessNeeds.src}
              alt={homeImages.businessNeeds.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
          <SectionHeading
            align="left"
            title="Escolha o que você precisa"
            description="Encontre a solução ideal para o momento da sua empresa. A WJB oferece orientação contábil, fiscal e tributária para ajudar você a tomar decisões com mais segurança, cumprir suas obrigações e focar no crescimento do seu negócio."
          />
        </div>
        <RevealStagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {needs.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(navigableCardClass, "group flex h-full flex-col gap-3 p-5")}
            >
              <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110">
                <item.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="text-foreground font-medium">{item.title}</span>
              <span className="text-muted-foreground text-sm">{item.description}</span>
              <span className="text-primary mt-auto flex items-center gap-1 text-sm font-medium">
                Ver mais
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
