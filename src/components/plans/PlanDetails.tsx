import Link from "next/link";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { planHowItWorksSteps, type Plan } from "@/config/plans";
import { getPlanWhatsAppLink } from "@/integrations/whatsapp";

import { PlanIncludedServices } from "./PlanIncludedServices";

/**
 * Template compartilhado pelas 3 páginas "Saiba mais" (/planos/mei,
 * /planos/simples-nacional, /planos/lucro-presumido) — seções 7-9 de
 * WJB_Planos_Simulador_Implementacao_Claude.md. Conteúdo vem inteiro de
 * `plan.detail` em src/config/plans.ts.
 */
export function PlanDetails({ plan }: { plan: Plan }) {
  const whatsAppLink = getPlanWhatsAppLink(plan.name) ?? "/contato";

  return (
    <>
      <Container className="py-12 sm:py-16">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Planos", href: "/planos" },
            { label: plan.name },
          ]}
        />

        <div className="mt-4 max-w-2xl">
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            {plan.detail.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {plan.detail.heroTitle}
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">{plan.detail.heroText}</p>
          <Link
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "cta", className: "mt-6" })}
          >
            {plan.detail.heroCta}
          </Link>
        </div>

        <div className="mt-16 max-w-2xl">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            {plan.detail.whatIsTitle}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {plan.detail.whatIsText.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Como funciona com a WJB
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {planHowItWorksSteps.map((item) => (
              <li key={item.step} className="flex flex-col gap-2">
                <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                  {item.step}
                </span>
                <h3 className="text-foreground font-medium">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-foreground text-2xl font-bold tracking-tight">
              O que você fará como cliente
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {plan.detail.clientResponsibilities.map((item) => (
                <li key={item} className="text-muted-foreground flex items-start gap-2 text-sm">
                  <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-foreground text-2xl font-bold tracking-tight">
              O que a WJB fará
            </h2>
            <div className="mt-4">
              <PlanIncludedServices services={plan.detail.wjbServices} />
            </div>
          </div>
        </div>

        <div className="border-border mt-16 flex flex-col items-center gap-4 rounded-md border p-8 text-center">
          <p className="text-foreground text-lg font-medium">
            Pronto para contratar o seu {plan.name}?
          </p>
          <Link
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "cta" })}
          >
            {plan.detail.finalCta}
          </Link>
        </div>
      </Container>
    </>
  );
}
