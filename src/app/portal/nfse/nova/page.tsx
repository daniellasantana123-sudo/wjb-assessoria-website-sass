import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { NfseRequestForm } from "@/components/wjb-ai/nfse-request-form";
import { SimulationNotice } from "@/components/wjb-ai/fiscal-status-badge";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";

export const metadata: Metadata = {
  title: "Solicitar NFS-e",
  robots: { index: false, follow: false },
};

export default async function PortalNfseNewPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  const now = new Date();
  const competence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "NFS-e", href: "/portal/nfse" },
          { label: "Solicitar" },
        ]}
      />
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Solicitar NFS-e
        </h1>
        {tenant ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Empresa emitente:{" "}
            <strong className="text-foreground">{tenant.name}</strong>
          </p>
        ) : null}
      </div>
      <SimulationNotice />
      {tenant ? (
        <div className="border-border max-w-3xl rounded-md border p-6">
          <NfseRequestForm
            tenantId={tenant.id}
            defaultCompetence={competence}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhuma empresa vinculada à sua conta.
        </p>
      )}
    </Container>
  );
}
