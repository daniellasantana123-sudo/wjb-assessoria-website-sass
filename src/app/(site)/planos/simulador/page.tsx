import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { PricingSimulator } from "@/components/plans/PricingSimulator";
import type { Regime } from "@/types/pricing";

export const metadata: Metadata = {
  title: "Simulador de Honorários Contábeis | WJB",
  description:
    "Simule o plano contábil da WJB conforme regime tributário, atividade, faturamento, sócios e empregados.",
};

const validRegimes: Regime[] = ["mei", "simples", "presumido"];

function parseRegime(value: string | string[] | undefined): Regime | null {
  if (typeof value !== "string") return null;
  return validRegimes.includes(value as Regime) ? (value as Regime) : null;
}

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ regime?: string | string[] }>;
}) {
  const { regime } = await searchParams;
  const initialRegime = parseRegime(regime);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Planos", href: "/planos" },
          { label: "Simulador" },
        ]}
      />
      <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        Simulador de honorários
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
        Responda algumas perguntas sobre sua empresa e veja uma estimativa mensal na hora.
      </p>
      <div className="mt-10">
        <PricingSimulator initialRegime={initialRegime} />
      </div>
    </Container>
  );
}
