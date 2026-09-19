import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type DigitalAccountingStatus,
  digitalAccountingItems,
} from "@/config/digital-accounting";
import { digitalAccountingImages } from "@/config/images";
import { headerCtas } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Contabilidade Digital",
  description:
    "Contabilidade organizada, acessível e conectada à rotina da sua empresa, com suporte humano por trás.",
  openGraph: {
    images: [{ url: "/images/og/contabilidade-digital.webp", width: 1200, height: 630 }],
  },
};

const statusTone: Record<DigitalAccountingStatus, BadgeTone> = {
  Disponível: "success",
  "Em implantação": "info",
  Planejado: "neutral",
};

const supportingImages = [
  { ...digitalAccountingImages.documents, label: "Organização de documentos" },
  { ...digitalAccountingImages.calendar, label: "Calendário e obrigações" },
  { ...digitalAccountingImages.support, label: "Suporte humano" },
];

/** WJB_Conteudos_Incompletos_Implementacao_Claude.md, seção 9. */
const benefits = [
  "Menos troca desorganizada de documentos",
  "Mais agilidade na comunicação",
  "Processos padronizados",
  "Histórico e rastreabilidade",
  "Informações disponíveis com mais clareza",
  "Integração com ferramentas digitais quando aplicável",
  "Atendimento humano apoiado por tecnologia",
];

export default function DigitalAccountingPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Contabilidade Digital" }]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            Contabilidade Digital
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-primary">Contabilidade organizada,</span>
            <br />
            acessível e conectada à rotina.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
            Ferramentas que organizam documentos e agilizam a comunicação com a WJB - sem
            substituir o atendimento humano, só com mais espaço para uma relação clara e
            consultiva.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={headerCtas.talkToAccountant.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "cta" })}
            >
              Conhecer a contabilidade digital
            </Link>
            <Link
              href="/area-do-cliente"
              className={buttonVariants({ variant: "outline" })}
            >
              Ver Área do Cliente
            </Link>
          </div>
        </div>

        <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
          <Image
            src={digitalAccountingImages.hero.src}
            alt={digitalAccountingImages.hero.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
      </div>

      <RevealStagger className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {supportingImages.map((item) => (
          <div key={item.src}>
            <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
            <p className="text-muted-foreground mt-2 text-sm font-medium">{item.label}</p>
          </div>
        ))}
      </RevealStagger>

      <RevealOnScroll as="section" className="border-border mt-12 max-w-3xl border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">Benefícios</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {[0, 1].map((column) => (
            <ul key={column} className="flex flex-col gap-3">
              {benefits
                .filter((_, index) => index % 2 === column)
                .map((item) => (
                  <li key={item} className="flex items-start gap-2 text-left">
                    <Check
                      aria-hidden="true"
                      className="text-primary mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span className="text-foreground text-sm">{item}</span>
                  </li>
                ))}
            </ul>
          ))}
        </div>
      </RevealOnScroll>

      <RevealStagger
        as="ul"
        itemAs="li"
        className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {digitalAccountingItems.map((item) => (
          <div
            key={item.title}
            className="border-border bg-background hover:border-primary/30 flex items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-200"
          >
            <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <item.icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="text-foreground flex-1 text-sm font-medium">{item.title}</span>
            <Badge tone={statusTone[item.status]} className="rounded-md">
              {item.status}
            </Badge>
          </div>
        ))}
      </RevealStagger>
    </Container>
  );
}
