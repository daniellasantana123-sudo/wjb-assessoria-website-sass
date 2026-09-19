import type { SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";

import { NewsletterForm } from "@/components/forms/newsletter-form";
import { serviceCategories } from "@/config/services";
import { siteConfig } from "@/config/site";

import { Container } from "./container";

const institutionalLinks = [
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
  { label: "Dúvidas", href: "/duvidas" },
  { label: "Conteúdos", href: "/conteudos" },
  { label: "Armel-x Tecnologia", href: "/armel-x-tecnologia" },
];

const legalLinks = [
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos de Uso", href: "/termos" },
  { label: "Cookies", href: "/cookies" },
];

/**
 * Facebook/Instagram não existem em lucide-react (a biblioteca de ícones já
 * instalada removeu logos de marca há um tempo) — em vez de adicionar uma
 * lib nova só para 2 ícones, uso SVG inline com os traços genéricos desses
 * logos (mesmo padrão de qualquer icon set open-source).
 */
function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H7.9V12h2.6V9.8c0-2.6 1.5-4 3.9-4 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Links reais só quando `siteConfig.social` tiver URL preenchida (nunca
 * inventar — seção 10 do documento). Sem link real, o ícone fica visível
 * mas inerte (sem href, opacidade reduzida), em vez de apontar pra "#".
 */
function SocialLinks() {
  const items = [
    { key: "facebook", Icon: FacebookIcon, href: siteConfig.social.facebook, label: "Facebook" },
    { key: "instagram", Icon: InstagramIcon, href: siteConfig.social.instagram, label: "Instagram" },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map(({ key, Icon, href, label }) => {
        const className =
          "flex h-[42px] w-[42px] items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none";

        if (!href) {
          return (
            <span
              key={key}
              aria-hidden="true"
              className={`${className} cursor-not-allowed opacity-40`}
            >
              <Icon className="h-5 w-5" />
            </span>
          );
        }

        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} da WJB Assessoria Contábil`}
            className={`${className} hover:border-primary hover:text-primary-foreground`}
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-100">
      <Container className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-4">
          <Image
            src="/brand/logos/logo-wjb-white.png"
            alt={siteConfig.name}
            width={164}
            height={93}
            className="h-16 w-auto shrink-0 self-start"
          />
          <p className="text-sm text-neutral-400">
            Contabilidade próxima para decisões melhores. Tecnologia para sua empresa ir
            mais longe.
          </p>
          <NewsletterForm />
        </div>

        <nav aria-label="Institucional" className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-100">Institucional</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {institutionalLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover:text-primary-foreground focus-visible:ring-primary rounded-md text-sm text-neutral-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Serviços" className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-100">Serviços</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {serviceCategories.map((service) => (
              <li key={service.href}>
                <Link
                  href={service.href}
                  className="hover:text-primary-foreground focus-visible:ring-primary rounded-md text-sm text-neutral-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-100">Fale conosco</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-400">
            {siteConfig.contact.phones.map((phone) => (
              <li key={phone.e164}>
                <a
                  href={phone.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-foreground focus-visible:ring-primary rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  WhatsApp: {phone.display}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <SocialLinks />
          </div>
        </div>
      </Container>

      <div className="border-t border-neutral-800">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-neutral-400 sm:flex-row">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p>
              © {year} {siteConfig.company.name}. Todos os direitos reservados.
            </p>
            <p>
              Tecnologia e experiência digital por{" "}
              <a
                href={siteConfig.partners.armelx.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-300"
              >
                {siteConfig.partners.armelx.name}
              </a>
            </p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-4">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="focus-visible:ring-primary rounded-md hover:text-neutral-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
    </footer>
  );
}
