import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { listAuditLog, listTenantOptions } from "@/lib/audit-log";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Logs",
  robots: { index: false, follow: false },
};

const actionLabels: Record<string, string> = {
  "tenant.created": "Empresa criada",
  "tenant.updated": "Empresa editada",
  "tenant.suspended": "Empresa suspensa",
  "tenant.reactivated": "Empresa reativada",
  "tenant_member.invited": "Pessoa convidada",
  "tenant_member.invite_resent": "Convite reenviado",
  "tenant_member.role_changed": "Papel alterado",
  "tenant_member.suspended": "Vínculo suspenso",
  "tenant_member.reactivated": "Vínculo reativado",
  "tenant_member.access_revoked": "Acesso revogado",
  "staff.invited": "Acesso interno concedido",
  "staff.invite_resent": "Convite interno reenviado",
  "staff.role_changed": "Papel interno alterado",
  "staff.access_revoked": "Acesso interno revogado",
  "account.suspended": "Conta suspensa",
  "account.reactivated": "Conta reativada",
  "document.uploaded": "Documento enviado",
  "document.deleted": "Documento apagado",
  "document.downloaded": "Documento baixado",
  "obligation.created": "Obrigação criada",
  "obligation.status_changed": "Status da obrigação alterado",
  "obligation.deleted": "Obrigação apagada",
  "lead.status_changed": "Status do lead alterado",
  "integration.omie_mapping_updated": "Mapeamento Omie atualizado",
  "integration.omie_sync_attempted": "Sincronização Omie",
  "integration.omie_disabled": "Integração Omie desativada",
  "integration.omie_reactivated": "Integração Omie reativada",
  "integration.omie_connection_tested": "Conexão Omie testada",
  "feature_flag.updated": "Feature flag alterada",
};

function describeMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const parts = Object.entries(metadata).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.join(" · ");
}

interface LogsSearchParams {
  tenantId?: string;
  actorQuery?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<LogsSearchParams>;
}) {
  await requireStaffSession();
  const filters = await searchParams;

  const [entries, tenants] = await Promise.all([listAuditLog(filters), listTenantOptions()]);

  const hasFilters = Boolean(
    filters.tenantId || filters.actorQuery || filters.action || filters.dateFrom || filters.dateTo,
  );

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Logs" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Logs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Auditoria de ações sensíveis (empresas, membros, documentos, obrigações, integrações,
          leads) - só registro, sem edição.
        </p>
      </div>

      <form method="get" className="border-border grid gap-4 rounded-md border p-6 sm:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tenantId">Empresa</Label>
          <Select id="tenantId" name="tenantId" defaultValue={filters.tenantId ?? ""}>
            <option value="">Todas</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actorQuery">Usuário (nome ou e-mail)</Label>
          <Input id="actorQuery" name="actorQuery" defaultValue={filters.actorQuery ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="action">Ação</Label>
          <Select id="action" name="action" defaultValue={filters.action ?? ""}>
            <option value="">Todas</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFrom">De</Label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateTo">Até</Label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
        </div>

        <div className="flex items-center gap-3 sm:col-span-5">
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Filtrar
          </button>
          {hasFilters && (
            <a href="/admin/logs" className="text-muted-foreground text-sm underline underline-offset-4">
              Limpar filtros
            </a>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          {hasFilters
            ? "Nenhum registro encontrado para esse filtro."
            : "Nenhum registro de auditoria ainda."}
        </p>
      ) : (
        <div className="border-border divide-border divide-y rounded-md border">
          {entries.map((entry) => (
            <div key={entry.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-foreground font-medium">
                  {actionLabels[entry.action] ?? entry.action}
                </p>
                {entry.tenantName && (
                  <span className="text-muted-foreground text-xs">{entry.tenantName}</span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {entry.actorName ?? entry.actorEmail ?? "Sistema"}
                {describeMetadata(entry.metadata)
                  ? ` · ${describeMetadata(entry.metadata)}`
                  : ""}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {new Date(entry.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
