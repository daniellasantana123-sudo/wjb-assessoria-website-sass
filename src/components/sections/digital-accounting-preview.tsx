import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type DigitalAccountingStatus,
  digitalAccountingItems,
} from "@/config/digital-accounting";
import { homeImages } from "@/config/images";

import { SectionHeading } from "./section-heading";

const statusTone: Record<DigitalAccountingStatus, BadgeTone> = {
  Disponível: "success",
  "Em implantação": "info",
  Planejado: "neutral",
};

export function DigitalAccountingPreview() {
  return (
    <section className="border-border bg-muted/30 border-b">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px] lg:order-1">
            <Image
              src={homeImages.digitalAccounting.src}
              alt={homeImages.digitalAccounting.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
          <div className="lg:order-2">
            <SectionHeading
              align="left"
              eyebrow="Contabilidade Digital"
              title="Organização digital, com gente de verdade por trás"
              description="A WJB está digitalizando a relação com o cliente aos poucos - sem prometer o que ainda não existe."
            />
            <Link
              href="/contabilidade-digital"
              className={buttonVariants({ variant: "outline", className: "mt-6" })}
            >
              Conhecer a Contabilidade Digital
            </Link>
          </div>
        </div>

        <RevealStagger
          as="ul"
          itemAs="li"
          className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
          itemClassName="h-full"
        >
          {digitalAccountingItems.map((item) => (
            <div
              key={item.title}
              className="border-border bg-background hover:border-primary/30 flex h-full items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-200"
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
    </section>
  );
}
