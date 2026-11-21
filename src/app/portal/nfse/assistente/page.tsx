import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { SimulationNotice } from "@/components/wjb-ai/fiscal-status-badge";
import { NfseAssistantChat } from "@/components/wjb-ai/nfse-assistant-chat";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";

export const metadata: Metadata = {
  title: "Assistente de NFS-e",
  robots: { index: false, follow: false },
};

/** Chat interno por regras (Fase 7). Desligado por padrão, como todo o módulo. */
export default async function PortalNfseAssistantPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) notFound();
  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "NFS-e", href: "/portal/nfse" },
          { label: "Assistente" },
        ]}
      />
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Assistente de NFS-e
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {tenant.name}. O assistente segue regras fixas e não usa inteligência
          artificial. Códigos, alíquotas e regime são definidos pelo contador.
        </p>
      </div>
      <SimulationNotice />
      <NfseAssistantChat tenantId={tenant.id} />
    </Container>
  );
}
