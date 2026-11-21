import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FiscalStatusBadge,
  SimulationNotice,
} from "@/components/wjb-ai/fiscal-status-badge";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import {
  filterList,
  paginate,
  parseListParams,
  STATUS_GROUPS,
  type StatusGroup,
} from "@/lib/wjb-ai/fiscal/portal-list";
import { listFiscalRequests } from "@/lib/wjb-ai/fiscal/requests.repo";

export const metadata: Metadata = {
  title: "Solicitações de NFS-e",
  robots: { index: false, follow: false },
};

function href(group: StatusGroup, q: string, page = 1) {
  const p = new URLSearchParams();
  if (group !== "todas") p.set("status", group);
  if (q) p.set("q", q);
  if (page > 1) p.set("pagina", String(page));
  const s = p.toString();
  return `/portal/nfse${s ? `?${s}` : ""}`;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Solicitações de NFS-e da empresa ativa (WJB AI, desligado por padrão). */
export default async function PortalNfsePage({
  searchParams,
}: PageProps<"/portal/nfse">) {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  const { group, page, q } = parseListParams(await searchParams);
  const all = tenant ? await listFiscalRequests(tenant.id) : [];
  const filtered = filterList(all, group, q);
  const view = paginate(filtered, page);

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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/nfse/assistente"
              className={buttonVariants({ variant: "outline" })}
            >
              Pedir pelo assistente
            </Link>
            <Link
              href="/portal/nfse/nova"
              className={buttonVariants({ variant: "cta" })}
            >
              Solicitar NFS-e
            </Link>
          </div>
        ) : null}
      </div>
      <SimulationNotice />

      {!tenant ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma empresa vinculada à sua conta.
        </p>
      ) : all.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">
            Nenhuma solicitação ainda
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            As solicitações que você enviar aparecem aqui com o andamento.
          </p>
        </div>
      ) : (
        <>
          <nav
            aria-label="Filtrar por situação"
            className="flex flex-wrap gap-2"
          >
            {(Object.keys(STATUS_GROUPS) as StatusGroup[]).map((g) => (
              <Link
                key={g}
                href={href(g, q)}
                aria-current={g === group ? "page" : undefined}
                className={cn(
                  "border-border rounded-full border px-3 py-1.5 text-sm",
                  g === group
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-foreground hover:bg-muted/40",
                )}
              >
                {STATUS_GROUPS[g].label}
              </Link>
            ))}
          </nav>
          <form
            method="get"
            action="/portal/nfse"
            role="search"
            className="flex flex-wrap items-end gap-2"
          >
            {group !== "todas" ? (
              <input type="hidden" name="status" value={group} />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="busca">
                Buscar por serviço, tomador ou competência
              </Label>
              <Input id="busca" name="q" defaultValue={q} maxLength={80} />
            </div>
            <button
              type="submit"
              className={buttonVariants({ variant: "outline" })}
            >
              Buscar
            </button>
          </form>

          <p className="text-muted-foreground text-sm" aria-live="polite">
            {view.total === 0
              ? "Nenhuma solicitação com esses filtros."
              : `${view.total} solicitação(ões)${view.pages > 1 ? `, página ${view.page} de ${view.pages}` : ""}.`}
          </p>

          {view.items.length ? (
            <ul className="border-border divide-border divide-y rounded-md border">
              {view.items.map((r) => (
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
                        {r.draft.taker.name} ·{" "}
                        {formatCents(r.draft.amountCents)} · competência{" "}
                        {r.draft.competence} · pedido em{" "}
                        {dateFmt.format(new Date(r.createdAt))}
                      </span>
                    </span>
                    <FiscalStatusBadge
                      status={r.status}
                      simulated={r.simulated}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {view.pages > 1 ? (
            <nav
              aria-label="Paginação"
              className="flex items-center justify-between gap-2"
            >
              {view.page > 1 ? (
                <Link
                  href={href(group, q, view.page - 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              {view.page < view.pages ? (
                <Link
                  href={href(group, q, view.page + 1)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Próxima
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </Container>
  );
}
