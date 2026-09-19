import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { listAuditLog } from "@/lib/audit-log";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Logs",
  robots: { index: false, follow: false },
};

const actionLabels: Record<string, string> = {
  "tenant.created": "Empresa criada",
  "tenant_member.invited": "Pessoa convidada",
  "document.uploaded": "Documento enviado",
  "document.deleted": "Documento apagado",
  "obligation.created": "Obrigação criada",
  "obligation.status_changed": "Status da obrigação alterado",
  "obligation.deleted": "Obrigação apagada",
  "lead.status_changed": "Status do lead alterado",
};

function describeMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const parts = Object.entries(metadata).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.join(" · ");
}

export default async function AdminLogsPage() {
  await requireStaffSession();
  const entries = await listAuditLog();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Logs" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Logs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Auditoria de ações sensíveis (empresas, membros, documentos, obrigações, leads) — só
          registro, sem edição.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          Nenhum registro de auditoria ainda.
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
