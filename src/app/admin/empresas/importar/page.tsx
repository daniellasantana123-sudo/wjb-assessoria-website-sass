import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import {
  GClickImportList,
  type GClickImportRow,
} from "@/components/integrations/gclick-import-list";
import { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import { requireStaffSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { documentsMatch } from "@/lib/integrations/client-search";
import { loadAllGClickClients } from "@/lib/integrations/gclick-clients";
import { hasPermission } from "@/lib/permissions/permissions";

export const metadata: Metadata = {
  title: "Importar do G-Click",
  robots: { index: false, follow: false },
};

/**
 * Importação de clientes do G-Click (2026-10-01). Mostra a carteira inteira
 * do G-Click cruzada com as empresas da plataforma, para trazer quem ainda
 * não está aqui sem cadastrar um por um.
 */
export default async function ImportarDoGClickPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireStaffSession();
  const { q } = await searchParams;

  const canImport =
    hasPermission(session, "organizations.manage") && hasPermission(session, "integrations.manage");

  let content: React.ReactNode;

  if (!canImport) {
    content = (
      <p className="text-muted-foreground text-sm">
        Importar empresas do G-Click fica com Contador e Super admin.
      </p>
    );
  } else if (!(await isFeatureEnabled("omie_gclick"))) {
    content = (
      <p className="text-muted-foreground text-sm">
        A integração Omie.G-Click está desativada no momento (Integrações → Feature flags).
      </p>
    );
  } else {
    const all = await loadAllGClickClients(getOmieGClickAdapter());
    if (!all.ok) {
      content = (
        <p role="alert" className="text-danger text-sm">
          Não foi possível ler os clientes do G-Click ({all.error.message}). Tente de novo em instantes.
        </p>
      );
    } else {
      const supabase = await createClient();
      const [{ data: tenants }, { data: mappings }] = await Promise.all([
        supabase.from("tenants").select("id, cnpj"),
        supabase.from("omie_client_mappings").select("tenant_id, external_client_id"),
      ]);
      const tenantByExternalId = new Map(
        (mappings ?? [])
          .filter((m) => m.external_client_id)
          .map((m) => [m.external_client_id as string, m.tenant_id]),
      );
      const mappedTenants = new Set(tenantByExternalId.values());

      const rows: GClickImportRow[] = all.data
        .filter((client) => client.externalId)
        .map((client) => {
          const externalId = client.externalId as string;
          const linkedTenant = tenantByExternalId.get(externalId) ?? null;
          const sameDocument = linkedTenant
            ? null
            : (tenants ?? []).find(
                (t) => !mappedTenants.has(t.id) && documentsMatch(t.cnpj, client.document),
              );
          return {
            externalId,
            name: client.name,
            tradeName: client.tradeName && client.tradeName !== client.name ? client.tradeName : null,
            document: client.document,
            state: linkedTenant ? "linked" : sameDocument ? "same_document" : "new",
            tenantId: linkedTenant ?? sameDocument?.id ?? null,
          } satisfies GClickImportRow;
        })
        .sort((a, b) => (a.tradeName ?? a.name).localeCompare(b.tradeName ?? b.name, "pt-BR"));

      content = (
        <>
          {all.truncated && (
            <p className="text-warning-text bg-warning-bg rounded-md p-3 text-sm">
              A conta do G-Click tem mais clientes do que esta tela lê de uma vez (1.500). Os demais
              aparecem depois que estes forem importados.
            </p>
          )}
          <GClickImportList rows={rows} initialQuery={q ?? ""} />
        </>
      );
    }
  }

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Empresas", href: "/admin/empresas" },
          { label: "Importar do G-Click" },
        ]}
      />
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Importar do G-Click</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Todos os clientes cadastrados no G-Click. Selecione os que ainda não estão na plataforma e
          clique em Importar: cada um vira uma empresa já vinculada ao G-Click, com o nome fantasia
          (ou a razão social) e o CNPJ. Nada é alterado no G-Click. Depois, abra a empresa para
          sincronizar as obrigações e convidar o cliente.
        </p>
      </div>
      {content}
    </Container>
  );
}
