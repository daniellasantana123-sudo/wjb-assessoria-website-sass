import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { DocumentsList } from "@/components/documents/documents-list";
import { requireSession } from "@/lib/auth/dal";
import { getMyPrimaryTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Guias",
  robots: { index: false, follow: false },
};

/**
 * Guias de pagamento (DAS, DARF etc.) — mesma infraestrutura de Documentos
 * (Storage + tabela `documents`), só filtrada por `category = 'guia'` (ver
 * `0009_document_category.sql`). Sem tabela nova, sem UI nova de verdade.
 */
export default async function PortalGuiasPage() {
  const session = await requireSession();
  const tenant = await getMyPrimaryTenant(session.userId);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Guias" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Guias</h1>
        {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, as guias de pagamento aparecem
            aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="border-border rounded-md border p-6">
            <UploadDocumentForm tenantId={tenant.id} defaultCategory="guia" />
          </div>
          <DocumentsList
            tenantId={tenant.id}
            category="guia"
            emptyMessage="Nenhuma guia enviada ainda."
          />
        </>
      )}
    </Container>
  );
}
