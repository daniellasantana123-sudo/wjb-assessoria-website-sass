import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { InviteMemberForm } from "@/components/tenant/invite-member-form";
import { MembersList } from "@/components/tenant/members-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { DocumentsList } from "@/components/documents/documents-list";
import { CreateObligationForm } from "@/components/obligations/create-obligation-form";
import { ObligationsCalendar } from "@/components/obligations/obligations-calendar";
import { ObligationsList } from "@/components/obligations/obligations-list";
import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";

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
  await requireStaffSession();
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();
  const calendarYear = parseIntParam(query.year, now.getFullYear());
  const calendarMonth = parseIntParam(query.month, now.getMonth() + 1);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, cnpj, created_at")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Empresas", href: "/admin/empresas" },
          { label: tenant.name },
        ]}
      />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">{tenant.name}</h1>
        {tenant.cnpj && <p className="text-muted-foreground mt-1 text-sm">{tenant.cnpj}</p>}
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Membros</h2>
        <MembersList tenantId={tenant.id} />
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
    </Container>
  );
}
