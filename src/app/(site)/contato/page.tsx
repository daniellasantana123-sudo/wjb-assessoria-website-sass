import type { ComponentType, SVGProps } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { FileText, Mail, MapPin } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { LeadForm } from "@/components/forms/lead-form";
import { RevealOnScroll } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { contactHeroImage } from "@/config/images";
import { getAddressEmbedMapUrl, getAddressMapUrl, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com um contador da WJB Assessoria Contábil.",
};

/**
 * WhatsApp não existe em lucide-react (a lib removeu logos de marca) —
 * mesmo padrão de SVG inline já usado pro Facebook/Instagram do footer
 * (site-footer.tsx): traço genérico reconhecível, não o arquivo de marca
 * oficial.
 */
function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.771.464 3.436 1.276 4.877L2 22l5.223-1.246A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Zm0 18a7.96 7.96 0 0 1-4.06-1.11l-.29-.17-3.09.737.75-3.02-.19-.3A7.96 7.96 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8Z" />
      <path d="M16.24 14.34c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41-.14-.01-.3-.01-.46-.01-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2.01s.86 2.33.98 2.49c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.4-.58 1.6-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function ContactRow({
  icon: Icon,
  label,
  href,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  const content = (
    <span className="text-foreground font-medium break-words">{children}</span>
  );

  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-col text-sm">
        <span className="text-muted-foreground">{label}</span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 hover:underline"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export default function ContactPage() {
  const mapEmbedUrl = getAddressEmbedMapUrl();

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contato" }]} />

      <div className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contato</h1>
        <p className="text-muted-foreground mt-3">
          Fale com um contador da WJB. Conte um pouco sobre sua empresa e retornaremos o
          quanto antes.
        </p>
      </div>

      <div className="group relative mt-8 aspect-[1800/947] w-full overflow-hidden rounded-[10px]">
        <Image
          src={contactHeroImage.src}
          alt={contactHeroImage.alt}
          fill
          sizes="(min-width: 1280px) 1152px, 100vw"
          priority
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>

      <RevealOnScroll
        as="div"
        className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.2fr]"
      >
        <div className="bg-muted/30 border-border flex flex-col gap-6 rounded-[8px] border p-6">
          <ContactRow icon={Mail} label="E-mail" href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </ContactRow>

          {siteConfig.contact.phones.map((phone) => (
            <ContactRow key={phone.e164} icon={WhatsAppIcon} label="WhatsApp" href={phone.href}>
              {phone.display}
            </ContactRow>
          ))}

          <ContactRow icon={MapPin} label="Endereço" href={getAddressMapUrl()}>
            {siteConfig.address.full}
          </ContactRow>

          <ContactRow icon={FileText} label="CNPJ">
            {siteConfig.company.cnpj}
          </ContactRow>

          <div className="border-border border-t pt-6">
            <h3 className="text-foreground text-lg font-semibold">
              Vamos cuidar da contabilidade da sua empresa?
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Converse com a WJB e descubra como podemos apoiar sua empresa com mais
              clareza, organização e segurança nas decisões contábeis, fiscais e
              tributárias.
            </p>
            <a
              href={siteConfig.contact.phones[0].href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "mt-4 w-full sm:w-auto",
              })}
            >
              Fale com a nossa equipe
            </a>
          </div>

          {mapEmbedUrl ? (
            <div className="border-border overflow-hidden rounded-[8px] border">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="260"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização da WJB Assessoria Contábil no mapa"
              />
            </div>
          ) : null}
        </div>

        <LeadForm
          formContext="Contato"
          submitLabel="Enviar mensagem"
          showCity
          showState
          showBusinessActivity
          messageLabel="Descreva sua necessidade"
        />
      </RevealOnScroll>
    </Container>
  );
}
