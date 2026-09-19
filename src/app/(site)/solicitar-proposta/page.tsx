import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { LeadForm } from "@/components/forms/lead-form";

export const metadata: Metadata = {
  title: "Solicitar Proposta",
  description:
    "Conte sobre a sua empresa e receba uma proposta da WJB Assessoria Contábil.",
};

export default function RequestProposalPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Solicitar proposta" }]}
      />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Solicitar proposta
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl">
        Conte um pouco sobre sua empresa e o que você precisa. Um contador da WJB entra em
        contato com uma proposta adequada ao seu momento.
      </p>
      <div className="mt-10 max-w-2xl">
        <LeadForm formContext="Solicitar proposta" submitLabel="Solicitar proposta" />
      </div>
    </Container>
  );
}
