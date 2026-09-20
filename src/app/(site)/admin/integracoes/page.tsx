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
import { getGClickConfig } from "@/integrations/omie-gclick";
import { listFeatureFlags } from "@/lib/feature-flags";

const MODE_LABELS = { mock: "Mock", sandbox: "Sandbox", production: "Produção" } as const;

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
  const { mode, realIntegrationEnabled } = getGClickConfig();

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
          <Badge tone={mode === "mock" ? "warning" : "neutral"}>Modo: {MODE_LABELS[mode]}</Badge>
        </div>

        {/* Seção 37 do prompt da Fase 6.5 - nunca apresentar como "Conectado" ao G-Click real. */}
        <dl className="text-muted-foreground mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:justify-start">
            <dt className="font-medium">Status:</dt>
            <dd>{mode === "mock" ? "Ambiente de desenvolvimento (simulado)" : "Bloqueado"}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:justify-start">
            <dt className="font-medium">Integração real:</dt>
            <dd>{realIntegrationEnabled ? "Habilitada na config, mas sem implementação ainda" : "Não habilitada"}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:justify-start sm:col-span-2">
            <dt className="font-medium">Validação Omie/G-Click:</dt>
            <dd>
              Pendente - ver <code>artifacts/wjb-saas-mvp/fase-6-5/omie-contact-checklist.md</code>
            </dd>
          </div>
        </dl>

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
                  <OmieStatusBadge status={mapping.status} mode={mode} />
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
