import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { servicePages } from "@/config/service-pages";
import { serviceCategories } from "@/config/services";
import { cn, navigableCardClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Serviços",
  description:
    "Contabilidade, fiscal e tributário, departamento pessoal, societário e legalização, e consultoria.",
};

export default function ServicesPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Serviços" }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Serviços</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        Tudo que sua empresa precisa em contabilidade, em um único lugar.
      </p>

      {serviceCategories.map((category) => {
        const items = servicePages.filter((service) => service.category === category.title);
        if (items.length === 0) return null;

        return (
          <RevealOnScroll key={category.title} as="section" className="border-border mt-12 border-t pt-8">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <category.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-foreground text-lg font-semibold">{category.title}</h2>
                <p className="text-muted-foreground text-sm">{category.description}</p>
              </div>
            </div>
            <RevealStagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((service) => (
                <Link
                  key={service.slug}
                  href={`/servicos/${service.slug}`}
                  className={cn(navigableCardClass, "group flex h-full flex-col gap-3 p-5")}
                >
                  <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110">
                    <service.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="text-foreground font-medium">{service.title}</h3>
                  <p className="text-muted-foreground text-sm">{service.shortDescription}</p>
                </Link>
              ))}
            </RevealStagger>
          </RevealOnScroll>
        );
      })}
    </Container>
  );
}
