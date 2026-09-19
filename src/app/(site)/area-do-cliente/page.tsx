import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type DigitalAccountingStatus,
  digitalAccountingItems,
} from "@/config/digital-accounting";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Área do Cliente",
  description: "A plataforma da WJB para clientes está em desenvolvimento.",
};

const statusTone: Record<DigitalAccountingStatus, BadgeTone> = {
  Disponível: "success",
  "Em implantação": "info",
  Planejado: "neutral",
};

/**
 * A plataforma SaaS pertence à V2 (WJB_Conteudos_Incompletos...md, seção 12)
 * — sem autenticação falsa, dashboard fictício ou senha simulada.
 */
export default function ClientAreaPage() {
  const primaryPhone = siteConfig.contact.phones[0];

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Área do Cliente" }]} />
      <Badge tone="info" className="mt-4">
        Em desenvolvimento
      </Badge>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Área do Cliente
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl">
        Estamos preparando uma nova experiência digital para centralizar o
        relacionamento entre clientes e a WJB Assessoria Contábil. A futura área do
        cliente poderá reunir recursos como documentos, solicitações, comunicados,
        obrigações, indicadores e outros serviços digitais. Enquanto essa experiência
        está em desenvolvimento, fale com nossa equipe pelos canais oficiais.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={primaryPhone.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "cta" })}
        >
          Falar pelo WhatsApp
        </a>
        <a
          href={`mailto:${siteConfig.contact.email}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Enviar e-mail
        </a>
      </div>

      <section className="border-border mt-12 max-w-2xl border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">O que está por vir</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {digitalAccountingItems.map((item) => (
            <li
              key={item.title}
              className="border-border bg-background flex items-center gap-3 rounded-md border px-4 py-3"
            >
              <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <item.icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="text-foreground flex-1 text-sm font-medium">{item.title}</span>
              <Badge tone={statusTone[item.status]} className="rounded-md">
                {item.status}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
