import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { NfseAdminNav } from "@/components/wjb-ai/admin/nfse-admin-nav";
import { FiscalStatusBadge } from "@/components/wjb-ai/fiscal-status-badge";
import { requireStaffSession } from "@/lib/auth/dal";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { ADMIN_QUEUE_LABELS, getAdminMetrics, listAdminRequests, type AdminQueue } from "@/lib/wjb-ai/fiscal/admin.repo";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "NFS-e", robots: { index: false, follow: false } };

const QUEUES = Object.keys(ADMIN_QUEUE_LABELS) as AdminQueue[];

/** Painel de solicitações de NFS-e (WJB AI, F3). Desligado por padrão. */
export default async function AdminNfsePage({ searchParams }: PageProps<"/admin/nfse">) {
  if (!isWjbAiEnabled()) notFound();
  await requireStaffSession();
  const { fila } = await searchParams;
  const queue: AdminQueue = QUEUES.includes(fila as AdminQueue) ? (fila as AdminQueue) : "revisao";
  const [requests, metrics] = await Promise.all([listAdminRequests(queue), getAdminMetrics()]);

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "NFS-e" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">Solicitações de NFS-e</h1>
        <Badge tone="warning">Conector simulado</Badge>
      </div>
      <NfseAdminNav current="/admin/nfse" />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Em revisão", metrics.byQueue.revisao],
          ["Na fila", metrics.byQueue.fila],
          ["Fila de erros", metrics.byQueue.erros],
          ["Envios simulados", metrics.attemptsSimulated],
        ].map(([label, value]) => (
          <div key={label} className="border-border rounded-md border p-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-foreground text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {metrics.oldestWaitingMinutes !== null ? (
        <p className="text-muted-foreground text-sm">Pedido aguardando há mais tempo: {metrics.oldestWaitingMinutes} min.</p>
      ) : null}

      <nav aria-label="Filas" className="flex flex-wrap gap-2">
        {QUEUES.map((q) => (
          <Link
            key={q}
            href={`/admin/nfse?fila=${q}`}
            aria-current={q === queue ? "page" : undefined}
            className={cn(
              "focus-visible:ring-primary rounded-full border px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none",
              q === queue ? "border-primary bg-primary text-white" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {ADMIN_QUEUE_LABELS[q]} ({metrics.byQueue[q]})
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <p className="border-border bg-muted/30 text-muted-foreground rounded-md border p-8 text-center text-sm">Nada nesta fila.</p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/nfse/${r.id}`} className="hover:bg-muted/40 focus-visible:ring-primary flex flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none">
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">{r.tenantName}: {r.draft.serviceDescription}</span>
                  <span className="text-muted-foreground text-xs">
                    {r.draft.taker.name} · {formatCents(r.draft.amountCents)} · {new Date(r.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {r.needsIntervention ? " · precisa de intervenção" : ""}
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
