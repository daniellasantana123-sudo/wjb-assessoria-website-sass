import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type DigitalAccountingStatus,
  digitalAccountingItems,
} from "@/config/digital-accounting";
import { siteConfig } from "@/config/site";
import { isSaasPublicEnabled } from "@/lib/saas-gate";

export const metadata: Metadata = {
  title: "Área do Cliente",
  description:
    "Plataforma da WJB para clientes: documentos, obrigações, guias, calendário e atendimento num só lugar. O acesso é liberado pela WJB no onboarding.",
};

const statusTone: Record<DigitalAccountingStatus, BadgeTone> = {
  Disponível: "success",
  "Em implantação": "info",
  Planejado: "neutral",
};

/**
 * Reescrita em 2026-09-23, quando a Plataforma SaaS entrou no ar. Até então
 * esta página anunciava a área do cliente como "em desenvolvimento" e
 * oferecia só WhatsApp/e-mail - conteúdo que deixou de ser verdade no dia
 * em que o Portal começou a responder em produção.
 *
 * Não existe autocadastro: as contas são provisionadas pela WJB no
 * onboarding (mesma regra registrada em `src/actions/auth.ts`). Por isso os
 * dois CTAs são deliberadamente diferentes - "entrar" para quem já tem
 * acesso, "solicitar" para quem ainda não tem. Um botão de entrar sozinho
 * deixaria o segundo grupo numa tela de login sem saída.
 *
 * O CTA de login respeita `isSaasPublicEnabled()`: se a plataforma for
 * fechada de novo, `src/proxy.ts` devolve 404 em `/login` e o botão
 * precisaria sumir junto, senão viraria link morto.
 */
export default function ClientAreaPage() {
  const primaryPhone = siteConfig.contact.phones[0];
  const saasOpen = isSaasPublicEnabled();

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Área do Cliente" }]} />
      <Badge tone="success" className="mt-4">
        Plataforma no ar
      </Badge>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Área do Cliente
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl">
        A plataforma da WJB reúne num só lugar os documentos da sua empresa, as
        guias e obrigações do período, o calendário de vencimentos e a conversa
        direta com quem cuida da sua contabilidade - sem depender de e-mail
        solto ou de procurar arquivo em conversa antiga.
      </p>
      <p className="text-muted-foreground mt-3 max-w-xl">
        O acesso é liberado pela própria WJB durante o onboarding: não há
        cadastro automático. Se a sua empresa já é cliente e você ainda não
        recebeu o convite, é só pedir por aqui.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {saasOpen ? (
          <Link href="/login" className={buttonVariants({ variant: "cta" })}>
            Entrar na plataforma
          </Link>
        ) : null}
        <a
          href={primaryPhone.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: saasOpen ? "outline" : "cta" })}
        >
          Solicitar meu acesso
        </a>
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        Prefere e-mail?{" "}
        <a
          href={`mailto:${siteConfig.contact.email}`}
          className="text-primary underline underline-offset-4"
        >
          {siteConfig.contact.email}
        </a>
      </p>

      <section className="border-border mt-12 max-w-2xl border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">
          O que você encontra na plataforma
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          A lista abaixo mostra o estado real de cada recurso - o que já está
          disponível e o que ainda está planejado.
        </p>
        <RevealStagger as="ul" itemAs="li" className="mt-4 flex flex-col gap-3">
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
      </section>
    </Container>
  );
}
