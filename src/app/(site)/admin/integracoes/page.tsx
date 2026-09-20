import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { OmieStatusBadge } from "@/components/integrations/omie-status-badge";
import { OmieConnectionTest } from "@/components/integrations/omie-connection-test";
import { FeatureFlagsPanel } from "@/components/admin/feature-flags-panel";
import { requireStaffSession } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import { listOmieMappings } from "@/lib/omie-gclick";
import { isOmieConfigured } from "@/integrations/omie-gclick";
import { listFeatureFlags } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Integrações",
  robots: { index: false, follow: false },
};

/**
 * Console Admin WJB > Integrações (Fase 5 do wjb-saas-mvp, 2026-09-20) -
 * visão geral entre empresas (o painel por empresa, criado na Fase 4,
 * continua em `/admin/empresas/[id]` pra configurar/sincronizar uma
 * específica - esta página não duplica aquele formulário, só lista e
 * linka pra lá).
 */
export default async function AdminIntegracoesPage() {
  const session = await requireStaffSession();
  const canManageFlags = hasPermission(session, "feature_flags.manage");

  const [mappings, flags] = await Promise.all([listOmieMappings(), listFeatureFlags()]);
  const configured = isOmieConfigured();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Integrações" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Integrações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Status entre empresas e kill switches operacionais.
        </p>
      </div>

      <div className="border-border rounded-md border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground text-sm font-semibold">Omie.G-Click</h2>
          <Badge tone={configured ? "success" : "warning"}>
            {configured ? "Credenciais configuradas" : "Bloqueado - ver auditoria técnica (Fase 6.5)"}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          A sincronização real está bloqueada até a documentação técnica oficial da API do G-Click
          ser confirmada - ver <code>artifacts/wjb-saas-mvp/fase-6-5/audit-report.md</code>.
        </p>
        <div className="mt-4">
          <OmieConnectionTest />
        </div>

        <div className="border-border divide-border mt-6 divide-y rounded-md border">
          {mappings.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">Nenhum mapeamento configurado ainda.</p>
          ) : (
            mappings.map((mapping) => (
              <Link
                key={mapping.tenantId}
                href={`/admin/empresas/${mapping.tenantId}`}
                className="hover:bg-muted/30 focus-visible:ring-primary flex flex-wrap items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                <div>
                  <p className="text-foreground font-medium">{mapping.tenantName}</p>
                  {mapping.lastError && mapping.status === "error" && (
                    <p className="text-danger mt-0.5 text-xs">{mapping.lastError}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {mapping.lastSyncedAt && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(mapping.lastSyncedAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                  <OmieStatusBadge status={mapping.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-1 text-sm font-semibold">Feature flags</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Kill switches operacionais - desligar aqui bloqueia a feature pra toda a plataforma,
          independente do status por empresa.
        </p>
        <FeatureFlagsPanel flags={flags} canManage={canManageFlags} />
        {!canManageFlags && (
          <p className="text-muted-foreground mt-3 text-sm">Só super_admin pode alterar feature flags.</p>
        )}
      </div>
    </Container>
  );
}
