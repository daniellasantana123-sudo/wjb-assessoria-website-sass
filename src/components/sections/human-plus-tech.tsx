import Image from "next/image";
import { Cpu, Users } from "lucide-react";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { homeImages } from "@/config/images";
import { cn, staticCardHoverClass } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

export function HumanPlusTech() {
  return (
    <section className="border-border border-b">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Humano + Tecnologia"
              title="Contabilidade próxima e mais clara"
              description="Tecnologia para sua empresa ir mais longe."
            />
            <RevealStagger className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2" itemClassName="h-full">
              <div
                className={cn(staticCardHoverClass, "border-border h-full rounded-md border p-6")}
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                  <Users aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-foreground mt-3 font-medium">Humano</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Contadores acessíveis, que explicam os números e ajudam a decidir - não
                  só fecham a folha e a apuração do mês.
                </p>
              </div>
              <div
                className={cn(staticCardHoverClass, "border-border h-full rounded-md border p-6")}
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                  <Cpu aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-foreground mt-3 font-medium">Tecnologia</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Organização digital de documentos, obrigações e comunicação, em parceria
                  com a Armel-x Tecnologia.
                </p>
              </div>
            </RevealStagger>
          </div>

          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
            <Image
              src={homeImages.humanPlusTech.src}
              alt={homeImages.humanPlusTech.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
