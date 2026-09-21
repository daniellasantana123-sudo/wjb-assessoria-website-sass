import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { PlansGrid } from "@/components/plans/PlansGrid";
import { JsonLd } from "@/components/shared/json-ld";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { headerCtas } from "@/config/navigation";
import { planAddons } from "@/config/plans";
import { getBreadcrumbSchema, getPlansCatalogSchema } from "@/lib/seo/schema";
import { cn, staticCardHoverClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Planos de Contabilidade | WJB Assessoria Contábil" },
  description:
    "Compare os planos mensais da WJB para MEI, Simples Nacional e Lucro Presumido e fale com a nossa equipe para receber o valor da contabilidade de acordo com o perfil da sua empresa.",
};

const breadcrumbItems = [{ label: "Home", href: "/" }, { label: "Planos" }];

export default function PlansPage() {
  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={getBreadcrumbSchema(breadcrumbItems)} />
      <JsonLd data={getPlansCatalogSchema()} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="mt-4 max-w-2xl">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          PLANOS MENSAIS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Contabilidade sob medida para a realidade da sua empresa.
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Escolha o regime da sua empresa e conheça o que está incluído em cada plano.
          Fale com a nossa equipe para receber o valor exato para o seu negócio.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={headerCtas.talkToAccountant.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "cta" })}
          >
            Fale com a nossa equipe
          </Link>
        </div>
      </div>

      <div className="mt-12">
        <PlansGrid />
      </div>

      <RevealOnScroll as="div" className="mt-16 max-w-2xl">
        <h2 className="text-foreground text-2xl font-bold tracking-tight">
          Personalize sua contabilidade
        </h2>
        <p className="text-muted-foreground mt-2">
          Algumas empresas precisam de apoio além da rotina mensal. Por isso, a WJB pode
          adicionar serviços complementares ao plano escolhido.
        </p>
      </RevealOnScroll>
      <RevealStagger className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2" itemClassName="h-full">
        {planAddons.map((addon) => (
          <div
            key={addon.id}
            className={cn(staticCardHoverClass, "border-border h-full rounded-md border p-5")}
          >
            <h3 className="text-foreground font-medium">{addon.name}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{addon.description}</p>
          </div>
        ))}
      </RevealStagger>

      <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-sm">
        Os valores apresentados são iniciais e podem variar conforme atividade,
        faturamento, número de sócios, empregados, volume operacional, estado, obrigações
        específicas e serviços adicionais. A contratação é formalizada somente após
        validação das informações pela WJB e aceite da proposta/contrato.
      </p>
    </Container>
  );
}
