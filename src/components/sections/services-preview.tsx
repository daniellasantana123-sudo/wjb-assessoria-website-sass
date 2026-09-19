import Link from "next/link";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { serviceCategories } from "@/config/services";
import { cn, navigableCardClass } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

export function ServicesPreview() {
  return (
    <section id="servicos" className="border-border border-b">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Serviços"
          title="Tudo que sua empresa precisa em contabilidade"
          description="Da escrituração à consultoria estratégica, em um único lugar."
        />
        <RevealStagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceCategories.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className={cn(navigableCardClass, "group block h-full p-5")}
            >
              <span className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110">
                <service.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-foreground font-medium">{service.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{service.description}</p>
            </Link>
          ))}
        </RevealStagger>
        <div className="mt-8 flex justify-center">
          <Link href="/servicos" className={buttonVariants({ variant: "outline" })}>
            Ver todos os serviços
          </Link>
        </div>
      </Container>
    </section>
  );
}
