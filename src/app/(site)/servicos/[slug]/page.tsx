import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { LeadForm } from "@/components/forms/lead-form";
import { JsonLd } from "@/components/shared/json-ld";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { getServiceOgImage } from "@/config/images";
import { headerCtas } from "@/config/navigation";
import { getServicePage, servicePages } from "@/config/service-pages";
import { getBreadcrumbSchema } from "@/lib/seo/schema";

export function generateStaticParams() {
  return servicePages.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) return {};

  return {
    title: service.title,
    description: service.shortDescription,
    openGraph: {
      images: [{ url: getServiceOgImage(service.slug), width: 1200, height: 630 }],
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();

  const related = servicePages.filter(
    (item) => item.category === service.category && item.slug !== service.slug,
  );

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Serviços", href: "/servicos" },
    { label: service.title },
  ];

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={getBreadcrumbSchema(breadcrumbItems)} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            {service.category}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {service.title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
            {service.shortDescription}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={headerCtas.talkToAccountant.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "cta" })}
            >
              {headerCtas.talkToAccountant.label}
            </Link>
            <Link
              href={headerCtas.requestProposal.href}
              className={buttonVariants({ variant: "outline" })}
            >
              {headerCtas.requestProposal.label}
            </Link>
          </div>
        </div>

        <div className="group relative aspect-[3/2] overflow-hidden rounded-[10px]">
          <Image
            src={service.image.src}
            alt={service.image.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
      </div>

      <RevealOnScroll as="section" className="border-border mt-12 border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">O que inclui</h2>
        <RevealStagger
          as="ul"
          itemAs="li"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {service.includes.map((item) => (
            <div key={item} className="text-foreground flex items-start gap-2 text-sm">
              <Check
                aria-hidden="true"
                className="text-primary mt-0.5 h-4 w-4 shrink-0"
              />
              {item}
            </div>
          ))}
        </RevealStagger>
        {service.note ? (
          <p className="text-muted-foreground mt-4 text-sm">{service.note}</p>
        ) : null}
      </RevealOnScroll>

      {service.leadFormContext ? (
        <RevealOnScroll as="section" className="border-border mt-12 max-w-2xl border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">
            {service.leadFormContext}: conte sua situação
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Preencha os dados abaixo e um contador da WJB entra em contato.
          </p>
          <div className="mt-6">
            <LeadForm
              formContext={service.leadFormContext}
              defaultServiceInterest={service.category}
              submitLabel="Enviar"
            />
          </div>
        </RevealOnScroll>
      ) : null}

      {related.length > 0 ? (
        <RevealOnScroll as="section" className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">
            Outros serviços em {service.category}
          </h2>
          <RevealStagger className="mt-4 flex flex-wrap gap-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/servicos/${item.slug}`}
                className="border-border hover:border-primary hover:bg-muted focus-visible:ring-primary text-foreground rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {item.title}
              </Link>
            ))}
          </RevealStagger>
        </RevealOnScroll>
      ) : null}
    </Container>
  );
}
