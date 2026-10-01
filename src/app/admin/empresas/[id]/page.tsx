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
import { getGClickConfig, getOmieGClickAdapter } from "@/integrations/omie-gclick";
import { CreateGClickTaskForm } from "@/components/integrations/create-gclick-task-form";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getTaskDepartments } from "@/lib/integrations/gclick-departments";
import { reactivateTenant, suspendTenant } from "@/actions/tenants";
import { ActionButton } from "@/components/shared/action-button";
import { parseCalendarParams } from "@/lib/calendar-params";

export const metadata: Metadata = {
  title: "Empresa",
  robots: { index: false, follow: false },
};


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
  const { year: calendarYear, month: calendarMonth } = parseCalendarParams(query);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, cnpj, status, created_at")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  const omieMapping = await getOmieMapping(tenant.id);
  const { mode: omieMode } = getGClickConfig();

  // Criar tarefa no G-Click: precisa do vínculo, da integração ligada e dos
  // departamentos configurados. Responsáveis vêm do próprio G-Click na hora;
  // se a consulta falhar, o formulário segue sem a lista.
  const canCreateTask = hasPermission(session, "tasks.create");
  const taskLinked = Boolean(omieMapping?.externalClientId) && omieMapping?.status !== "disabled";
  const gclickOn = await isFeatureEnabled("omie_gclick");
  let taskResponsibles: { id: string; name: string; role: string | null }[] = [];
  let taskDepartments: { id: number; name: string }[] = [];
  if (canCreateTask && taskLinked && gclickOn && omieMapping?.externalClientId) {
    const adapter = getOmieGClickAdapter();
    const [found, departments] = await Promise.all([
      adapter.clients.listResponsibles(omieMapping.externalClientId),
      getTaskDepartments(adapter),
    ]);
    if (found.ok) {
      taskResponsibles = found.data.map((p) => ({ id: p.externalId, name: p.name, role: p.role }));
    }
    taskDepartments = departments.departments;
  }
  const canSuspendTenant = hasPermission(session, "tenants.suspend");
  // Atendimento não apaga documentos, não mexe em obrigações nem no G-Click.
  const canDeleteDocuments = hasPermission(session, "documents.delete");
  const canManageObligations = hasPermission(session, "obligations.manage");
  const canManageIntegration = hasPermission(session, "integrations.manage");
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
          <ActionButton
            label={isSuspended ? "Reativar empresa" : "Suspender empresa"}
            confirmMessage={
              isSuspended
                ? undefined
                : `Suspender ${tenant.name}? Ninguém da empresa consegue acessar o Portal até ela ser reativada.`
            }
            action={async () => {
              "use server";
              if (isSuspended) {
                await reactivateTenant(tenant.id);
              } else {
                await suspendTenant(tenant.id);
              }
            }}
          />
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
        <DocumentsList tenantId={tenant.id} category="documento" canDelete={canDeleteDocuments} />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Guias</h2>
        <div className="border-border mb-4 rounded-md border p-6">
          <UploadDocumentForm tenantId={tenant.id} defaultCategory="guia" />
        </div>
        <DocumentsList
          tenantId={tenant.id}
          category="guia"
          canDelete={canDeleteDocuments}
          emptyMessage="Nenhuma guia enviada ainda."
        />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Obrigações</h2>
        {canManageObligations ? (
          <div className="border-border mb-4 rounded-md border p-6">
            <CreateObligationForm tenantId={tenant.id} />
          </div>
        ) : (
          <p className="text-muted-foreground mb-4 text-sm">
            Lançar, concluir e apagar obrigações fica com Contador e Super admin.
          </p>
        )}
        <ObligationsList tenantId={tenant.id} canManage={canManageObligations} />
      </div>

      <div>
        <h2 className="text-foreground mb-4 text-sm font-semibold">Calendário</h2>
        <ObligationsCalendar tenantId={tenant.id} year={calendarYear} month={calendarMonth} />
      </div>

      {canCreateTask && (
        <div className="border-border rounded-md border p-6">
          <h2 className="text-foreground text-sm font-semibold">Criar tarefa no G-Click</h2>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            A tarefa entra na fila do escritório no G-Click, já ligada a esta empresa. O prazo e o
            andamento são definidos lá.
          </p>
          {!gclickOn ? (
            <p className="text-muted-foreground text-sm">A integração Omie.G-Click está desativada no momento.</p>
          ) : !taskLinked ? (
            <p className="text-muted-foreground text-sm">
              Vincule esta empresa ao G-Click (painel abaixo) para criar tarefas.
            </p>
          ) : taskDepartments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Não foi possível descobrir os departamentos do G-Click agora (eles vêm das tarefas
              existentes). Tente de novo em instantes ou configure a variável{" "}
              <code>GCLICK_DEPARTAMENTOS</code> na hospedagem (ex.: <code>1:Fiscal;2:Contábil</code>).
            </p>
          ) : (
            <CreateGClickTaskForm
              tenantId={tenant.id}
              departments={taskDepartments}
              responsibles={taskResponsibles}
            />
          )}
        </div>
      )}

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Integração Omie.G-Click</h2>
        {canManageIntegration ? (
          <OmieMappingPanel
            tenantId={tenant.id}
            tenantDocument={tenant.cnpj}
            mapping={omieMapping}
            mode={omieMode}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            A integração com o G-Click é gerenciada por Contador e Super admin.
          </p>
        )}
      </div>
    </Container>
  );
}
