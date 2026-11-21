import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NfseAdminNav } from "@/components/wjb-ai/admin/nfse-admin-nav";
import { FiscalStatusBadge } from "@/components/wjb-ai/fiscal-status-badge";
import { requireStaffSession } from "@/lib/auth/dal";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import {
  ADMIN_QUEUE_LABELS,
  getAdminMetrics,
  listAdminRequests,
  listReviewStaff,
  listTenantsForFilter,
  type AdminQueue,
} from "@/lib/wjb-ai/fiscal/admin.repo";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { loadFiscalAlerts } from "@/lib/wjb-ai/fiscal/monitoring.repo";
import {
  isPriority,
  PRIORITIES,
  slaState,
} from "@/lib/wjb-ai/fiscal/review-queue";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "NFS-e",
  robots: { index: false, follow: false },
};

const QUEUES = Object.keys(ADMIN_QUEUE_LABELS) as AdminQueue[];

/** Painel de solicitações de NFS-e (WJB AI, F3). Desligado por padrão. */
export default async function AdminNfsePage({
  searchParams,
}: PageProps<"/admin/nfse">) {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const fila = one("fila");
  const queue: AdminQueue = QUEUES.includes(fila as AdminQueue)
    ? (fila as AdminQueue)
    : "revisao";
  const empresa = /^[0-9a-f-]{36}$/i.test(one("empresa")) ? one("empresa") : "";
  const minhas = one("minhas") === "1";
  const [requests, metrics, alerts, tenants, staff] = await Promise.all([
    listAdminRequests(queue, {
      tenantId: empresa || undefined,
      assignedTo: minhas ? session.userId : undefined,
    }),
    getAdminMetrics(),
    loadFiscalAlerts(),
    listTenantsForFilter(),
    listReviewStaff(),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const now = new Date();
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({
      fila: queue,
      ...(empresa ? { empresa } : {}),
      ...(minhas ? { minhas: "1" } : {}),
      ...extra,
    });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/admin/nfse?${p.toString()}`;
  };

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[{ label: "Admin WJB", href: "/admin" }, { label: "NFS-e" }]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">
          Solicitações de NFS-e
        </h1>
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
        <p className="text-muted-foreground text-sm">
          Pedido aguardando há mais tempo: {metrics.oldestWaitingMinutes} min.
        </p>
      ) : null}

      <section
        aria-labelledby="alertas"
        className="border-border rounded-md border p-4"
      >
        <h2 id="alertas" className="text-foreground text-sm font-semibold">
          Alertas {alerts.length ? `(${alerts.length})` : ""}
        </h2>
        {alerts.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Nenhum alerta: certificados, procurações e fila em ordem.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {alerts.slice(0, 20).map((a, i) => (
              <li
                key={`${a.code}-${a.refId ?? i}`}
                className="flex flex-wrap items-start gap-2"
              >
                <Badge tone={a.severity === "critico" ? "danger" : "warning"}>
                  {a.severity === "critico" ? "crítico" : "atenção"}
                </Badge>
                <span className="text-foreground min-w-0 break-words">
                  {a.message}
                </span>
                {a.refId &&
                [
                  "RESULTADO_INDETERMINADO_PARADO",
                  "FILA_DE_ERROS",
                  "REJEICAO_CERTIFICADO",
                ].includes(a.code) ? (
                  <Link
                    href={`/admin/nfse/${a.refId}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    abrir pedido
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Filas" className="flex flex-wrap gap-2">
        {QUEUES.map((q) => (
          <Link
            key={q}
            href={qs({ fila: q })}
            aria-current={q === queue ? "page" : undefined}
            className={cn(
              "focus-visible:ring-primary rounded-full border px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none",
              q === queue
                ? "border-primary bg-primary text-white"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {ADMIN_QUEUE_LABELS[q]} ({metrics.byQueue[q]})
          </Link>
        ))}
      </nav>

      <form
        method="get"
        action="/admin/nfse"
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="fila" value={queue} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="empresa">Empresa</Label>
          <Select id="empresa" name="empresa" defaultValue={empresa}>
            <option value="">Todas</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="text-foreground flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="minhas"
            value="1"
            defaultChecked={minhas}
          />
          Só as atribuídas a mim
        </label>
        <button
          type="submit"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Filtrar
        </button>
      </form>

      {requests.length === 0 ? (
        <p className="border-border bg-muted/30 text-muted-foreground rounded-md border p-8 text-center text-sm">
          Nada nesta fila.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/nfse/${r.id}`}
                className="hover:bg-muted/40 focus-visible:ring-primary flex flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {r.tenantName}: {r.draft.serviceDescription}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.draft.taker.name} · {formatCents(r.draft.amountCents)} ·{" "}
                    {new Date(r.updatedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {r.needsIntervention ? " · precisa de intervenção" : ""}
                    {r.assignedTo
                      ? ` · com ${staffName.get(r.assignedTo) ?? "equipe"}`
                      : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {r.status === "REVISAO_HUMANA" && isPriority(r.priority) ? (
                    <>
                      {r.priority !== "normal" ? (
                        <Badge
                          tone={r.priority === "urgente" ? "danger" : "neutral"}
                        >
                          {PRIORITIES[r.priority].label}
                        </Badge>
                      ) : null}
                      {slaState(r.reviewDueAt, r.priority, now) ===
                      "vencido" ? (
                        <Badge tone="danger">prazo vencido</Badge>
                      ) : slaState(r.reviewDueAt, r.priority, now) ===
                        "vence_logo" ? (
                        <Badge tone="warning">vence logo</Badge>
                      ) : null}
                    </>
                  ) : null}
                  <FiscalStatusBadge status={r.status} simulated />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
