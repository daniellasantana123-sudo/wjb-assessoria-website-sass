import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import {
  FiscalStatusBadge,
  SimulationNotice,
} from "@/components/wjb-ai/fiscal-status-badge";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { listFiscalRequests } from "@/lib/wjb-ai/fiscal/requests.repo";

export const metadata: Metadata = {
  title: "Solicitações de NFS-e",
  robots: { index: false, follow: false },
};

/** Histórico de solicitações de NFS-e (WJB AI, desligado por padrão). */
export default async function PortalNfsePage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  const requests = tenant ? await listFiscalRequests(tenant.id) : [];

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[{ label: "Portal", href: "/portal" }, { label: "NFS-e" }]}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">
            Solicitações de NFS-e
          </h1>
          {tenant ? (
            <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>
          ) : null}
        </div>
        {tenant ? (
          <Link
            href="/portal/nfse/nova"
            className={buttonVariants({ variant: "cta" })}
          >
            Solicitar NFS-e
          </Link>
        ) : null}
      </div>
      <SimulationNotice />

      {!tenant ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma empresa vinculada à sua conta.
        </p>
      ) : requests.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">
            Nenhuma solicitação ainda
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            As solicitações que você enviar aparecem aqui com o andamento.
          </p>
        </div>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/portal/nfse/${r.id}`}
                className="hover:bg-muted/40 focus-visible:ring-primary flex flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {r.draft.serviceDescription}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.draft.taker.name} · {formatCents(r.draft.amountCents)} ·
                    competência {r.draft.competence}
                  </span>
                </span>
                <FiscalStatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
