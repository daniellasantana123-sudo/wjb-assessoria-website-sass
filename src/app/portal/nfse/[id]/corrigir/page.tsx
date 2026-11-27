import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { correctNfseAction } from "@/actions/wjb-ai-fiscal";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { SimulationNotice } from "@/components/wjb-ai/fiscal-status-badge";
import { NfseRequestForm } from "@/components/wjb-ai/nfse-request-form";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { getFiscalRequest } from "@/lib/wjb-ai/fiscal/requests.repo";

export const metadata: Metadata = {
  title: "Corrigir solicitação de NFS-e",
  robots: { index: false, follow: false },
};
const UUID = /^[0-9a-f-]{36}$/i;

/** Correção de um pedido devolvido pelo contador; o histórico é mantido. */
export default async function PortalNfseCorrectPage({
  params,
}: PageProps<"/portal/nfse/[id]/corrigir">) {
  if (!isWjbAiEnabled()) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  const request = tenant ? await getFiscalRequest(tenant.id, id) : null;
  if (!request || !tenant || request.status !== "DADOS_PENDENTES") notFound();
  const d = request.draft;
  const motivo = [...request.events]
    .reverse()
    .find((e) => e.toStatus === "DADOS_PENDENTES")?.reason;

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "NFS-e", href: "/portal/nfse" },
          { label: "Corrigir" },
        ]}
      />
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Corrigir solicitação de NFS-e
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Empresa emitente:{" "}
          <strong className="text-foreground">{tenant.name}</strong>
        </p>
      </div>
      {motivo ? (
        <p className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm">
          {motivo}
        </p>
      ) : null}
      <SimulationNotice />
      <div className="border-border max-w-3xl rounded-md border p-6">
        <NfseRequestForm
          tenantId={tenant.id}
          defaultCompetence={d.competence}
          initial={{
            serviceDescription: d.serviceDescription,
            grossAmount: (d.amountCents / 100).toFixed(2).replace(".", ","),
            competence: d.competence,
            takerDocument: d.taker.document,
            takerName: d.taker.name,
            takerEmail: d.taker.email ?? "",
            sourceReference: d.sourceReference ?? "",
            recipientIsTaker:
              d.recipientIsTaker === true ? "sim" : d.recipientIsTaker === false ? "nao" : "",
          }}
          submitAction={correctNfseAction.bind(null, id)}
          confirmLabel="Confirmar correção"
        />
      </div>
    </Container>
  );
}
