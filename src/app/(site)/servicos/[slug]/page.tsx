import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { LeadForm } from "@/components/forms/lead-form";
import { JsonLd } from "@/components/shared/json-ld";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { getServiceOgImage } from "@/config/images";
import { headerCtas } from "@/config/navigation";
import { getServiceDetail } from "@/config/service-details";
import { getServicePage, servicePages } from "@/config/service-pages";
import { getWhatsAppLink } from "@/integrations/whatsapp";
import { getBreadcrumbSchema, getServiceSchema } from "@/lib/seo/schema";

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
    description: service.seoDescription ?? service.shortDescription,
    alternates: { canonical: `/servicos/${service.slug}` },
    openGraph: {
      images: [{ url: getServiceOgImage(service.slug), width: 1200, height: 630 }],
    },
  };
}

/**
 * Página de serviço orientada a conversão (2026-11-09, Fase 3 do plano
 * comercial). Ordem pensada para quem chega pelo Google ou por anúncio:
 * o que é e o botão principal logo no topo; para quem é e o que inclui;
 * como funciona; o que ter em mãos; perguntas frequentes; e o formulário
 * na própria página, com o serviço já preenchido. O botão principal leva
 * ao formulário (âncora) para o visitante não precisar sair da página.
 */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  const detail = getServiceDetail(slug);

  const related = servicePages.filter(
    (item) => item.category === service.category && item.slug !== service.slug,
  );
  const whatsappHref =
    getWhatsAppLink(
      detail?.whatsappMessage ??
        `Olá! Vim pelo site da WJB e quero saber mais sobre ${service.title}.`,
    ) ?? headerCtas.talkToAccountant.href;

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Serviços", href: "/servicos" },
    { label: service.title },
  ];

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={getBreadcrumbSchema(breadcrumbItems)} />
      <JsonLd data={getServiceSchema(service)} />
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
            {detail?.intro ?? service.shortDescription}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#formulario" className={buttonVariants({ variant: "cta" })}>
              {detail?.primaryCta ?? headerCtas.requestProposal.label}
            </a>
            <Link
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Falar pelo WhatsApp
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

      <RevealOnScroll
        as="section"
        className="border-border mt-12 grid grid-cols-1 gap-10 border-t pt-8 lg:grid-cols-2"
      >
        {detail ? (
          <div>
            <h2 className="text-foreground text-lg font-semibold">Para quem é</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {detail.audience.map((item) => (
                <li key={item} className="text-foreground flex items-start gap-2 text-sm">
                  <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h2 className="text-foreground text-lg font-semibold">O que inclui</h2>
          <RevealStagger
            as="ul"
            itemAs="li"
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {service.includes.map((item) => (
              <div key={item} className="text-foreground flex items-start gap-2 text-sm">
                <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                {item}
              </div>
            ))}
          </RevealStagger>
          {service.note ? (
            <p className="text-muted-foreground mt-4 text-sm">{service.note}</p>
          ) : null}
        </div>
      </RevealOnScroll>

      {detail ? (
        <RevealOnScroll as="section" className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">Como funciona</h2>
          <RevealStagger
            as="ol"
            itemAs="li"
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {detail.steps.map((step, index) => (
              <div
                key={step.title}
                className="border-border bg-background h-full rounded-md border p-5"
              >
                <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <h3 className="text-foreground mt-3 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{step.description}</p>
              </div>
            ))}
          </RevealStagger>
        </RevealOnScroll>
      ) : null}

      {detail?.documents ? (
        <RevealOnScroll as="section" className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">O que ter em mãos</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Não precisa ter tudo para começar: a equipe confirma o que falta na conversa
            inicial.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {detail.documents.map((item) => (
              <li key={item} className="text-foreground flex items-start gap-2 text-sm">
                <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </RevealOnScroll>
      ) : null}

      <div className="border-border mt-12 grid grid-cols-1 gap-10 border-t pt-8 lg:grid-cols-2">
        {detail ? (
          <RevealOnScroll as="section">
            <h2 className="text-foreground text-lg font-semibold">Perguntas frequentes</h2>
            <div className="divide-border border-border mt-4 divide-y border-y">
              {detail.faq.map((item) => (
                <details key={item.question} className="group py-1">
                  <summary className="text-foreground focus-visible:ring-primary flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown
                      aria-hidden="true"
                      className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="text-muted-foreground pb-3 text-sm">{item.answer}</p>
                </details>
              ))}
            </div>
          </RevealOnScroll>
        ) : null}

        <RevealOnScroll as="section" id="formulario" className="scroll-mt-24">
          <h2 className="text-foreground text-lg font-semibold">
            {service.title}: fale com a WJB
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Preencha os dados abaixo e um contador da WJB entra em contato. Atendimento de
            segunda a sexta, das 9h às 18h.
          </p>
          <div className="mt-6">
            <LeadForm
              formContext={service.leadFormContext ?? service.title}
              defaultServiceInterest={service.title}
              showServiceInterest={false}
              submitLabel={detail?.primaryCta ?? "Enviar"}
            />
          </div>
        </RevealOnScroll>
      </div>

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
