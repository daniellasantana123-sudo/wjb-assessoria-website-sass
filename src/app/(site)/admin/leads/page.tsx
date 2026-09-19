import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { LeadsList } from "@/components/leads/leads-list";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

export default async function AdminLeadsPage() {
  await requireStaffSession();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Leads" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enviados pelos formulários do site (contato, proposta, simulador, assistente virtual,
          newsletter).
        </p>
      </div>

      <LeadsList />
    </Container>
  );
}
