import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { InviteMemberForm } from "@/components/tenant/invite-member-form";
import { MembersList } from "@/components/tenant/members-list";
import { EditTenantForm } from "@/components/admin/edit-tenant-form";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { DocumentsList } from "@/components/documents/documents-list";
import { CreateObligationForm } from "@/components/obligations/create-obligation-form";
import { ObligationsCalendar } from "@/components/obligations/obligations-calendar";
import { ObligationsList } from "@/components/obligations/obligations-list";
import { OmieMappingPanel } from "@/components/integrations/omie-mapping-panel";
import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import { getOmieMapping } from "@/lib/omie-gclick";
import { getGClickConfig } from "@/integrations/omie-gclick";
import { reactivateTenant, suspendTenant } from "@/actions/tenants";

export const metadata: Metadata = {
  title: "Empresa",
  robots: { index: false, follow: false },
};

function parseIntParam(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string | string[]; month?: string | string[] }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();
  const calendarYear = parseIntParam(query.year, now.getFullYear());
  const calendarMonth = parseIntParam(query.month, now.getMonth() + 1);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, cnpj, status, created_at")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  const omieMapping = await getOmieMapping(tenant.id);
  const { mode: omieMode } = getGClickConfig();
  const canSuspendTenant = hasPermission(session, "tenants.suspend");
  const isSuspended = tenant.status === "suspended";

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Empresas", href: "/admin/empresas" },
          { label: tenant.name },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold">{tenant.name}</h1>
            {isSuspended && <Badge tone="danger">Suspensa</Badge>}
          </div>
          {tenant.cnpj && <p className="text-muted-foreground mt-1 text-sm">{tenant.cnpj}</p>}
        </div>
        {canSuspendTenant && (
          <form
            action={async () => {
              "use server";
              if (isSuspended) {
                await reactivateTenant(tenant.id);
              } else {
                await suspendTenant(tenant.id);
              }
            }}
          >
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isSuspended ? "Reativar empresa" : "Suspender empresa"}
            </button>
          </form>
        )}
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Editar empresa</h2>
        <EditTenantForm tenantId={tenant.id} name={tenant.name} cnpj={tenant.cnpj} />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Membros</h2>
        <MembersList tenantId={tenant.id} canManage />
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Convidar pessoa</h2>
        <InviteMemberForm tenantId={tenant.id} />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Documentos</h2>
        <div className="border-border mb-4 rounded-md border p-6">
          <UploadDocumentForm tenantId={tenant.id} defaultCategory="documento" />
        </div>
        <DocumentsList tenantId={tenant.id} category="documento" canDelete />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Guias</h2>
        <div className="border-border mb-4 rounded-md border p-6">
          <UploadDocumentForm tenantId={tenant.id} defaultCategory="guia" />
        </div>
        <DocumentsList
          tenantId={tenant.id}
          category="guia"
          canDelete
          emptyMessage="Nenhuma guia enviada ainda."
        />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Obrigações</h2>
        <div className="border-border mb-4 rounded-md border p-6">
          <CreateObligationForm tenantId={tenant.id} />
        </div>
        <ObligationsList tenantId={tenant.id} canManage />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Calendário</h2>
        <ObligationsCalendar tenantId={tenant.id} year={calendarYear} month={calendarMonth} />
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Integração Omie.G-Click</h2>
        <OmieMappingPanel
          tenantId={tenant.id}
          tenantDocument={tenant.cnpj}
          mapping={omieMapping}
          mode={omieMode}
        />
      </div>
    </Container>
  );
}
