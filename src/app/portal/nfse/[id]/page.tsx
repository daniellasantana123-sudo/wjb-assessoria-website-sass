import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import {
  FiscalStatusBadge,
  SimulationNotice,
} from "@/components/wjb-ai/fiscal-status-badge";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { FISCAL_STATUS_LABELS, formatCents } from "@/lib/wjb-ai/fiscal/labels";
import {
  POLICY_REASON_LABELS,
  type PolicyReason,
} from "@/lib/wjb-ai/fiscal/policy";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  countRequestVersions,
  getFiscalRequest,
} from "@/lib/wjb-ai/fiscal/requests.repo";

export const metadata: Metadata = {
  title: "Solicitação de NFS-e",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PortalNfseDetailPage({
  params,
  searchParams,
}: PageProps<"/portal/nfse/[id]">) {
  if (!isWjbAiEnabled()) notFound();
  const { id } = await params;
  const { duplicada, corrigida } = await searchParams;
  if (!UUID.test(id)) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  // Busca sempre restrita à empresa ativa: pedido de outra empresa = 404.
  const request = tenant ? await getFiscalRequest(tenant.id, id) : null;
  if (!request) notFound();
  const versions = tenant ? await countRequestVersions(tenant.id, id) : 0;
  const d = request.draft;
  const date = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "NFS-e", href: "/portal/nfse" },
          { label: "Solicitação" },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">
          Solicitação de NFS-e
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <FiscalStatusBadge
            status={request.status}
            simulated={request.simulated}
          />
          <Link
            href={`/portal/nfse/${request.id}/previa`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Prévia (simulação)
          </Link>
        </div>
      </div>
      {request.simulatedReference ? (
        <p
          role="status"
          className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm"
        >
          Resultado de <strong>simulação</strong> ({request.simulatedReference}
          ): esta nota não foi emitida e não tem valor fiscal.
        </p>
      ) : null}
      {duplicada ? (
        <p
          role="status"
          className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm"
        >
          Esta solicitação já tinha sido registrada. Nenhum pedido novo foi
          criado.
        </p>
      ) : null}
      {corrigida ? (
        <p
          role="status"
          className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm"
        >
          Correção registrada. A versão anterior foi guardada no histórico.
        </p>
      ) : null}
      {request.status === "DADOS_PENDENTES" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-foreground text-sm">
            A WJB pediu uma correção nesta solicitação.
          </p>
          <Link
            href={`/portal/nfse/${request.id}/corrigir`}
            className={buttonVariants({ variant: "cta", size: "sm" })}
          >
            Corrigir solicitação
          </Link>
        </div>
      ) : null}
      {versions > 0 ? (
        <p className="text-muted-foreground text-sm">
          Esta solicitação foi corrigida {versions}{" "}
          {versions === 1 ? "vez" : "vezes"}; as versões anteriores ficam
          guardadas.
        </p>
      ) : null}
      <SimulationNotice />

      <section className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">
          Dados da solicitação
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Empresa emitente</dt>
            <dd className="text-foreground">{tenant?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Enviada em</dt>
            <dd className="text-foreground">{date(request.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd className="text-foreground break-words">
              {d.serviceDescription}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="text-foreground">{formatCents(d.amountCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Competência</dt>
            <dd className="text-foreground">{d.competence}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tomador</dt>
            <dd className="text-foreground break-words">{d.taker.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{d.taker.documentKind}</dt>
            <dd className="text-foreground">***{d.taker.document.slice(-4)}</dd>
          </div>
        </dl>
      </section>

      {request.policyReasons.length ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-2 text-sm font-semibold">
            Por que está em revisão
          </h2>
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {request.policyReasons.map((code) => (
              <li key={code}>
                {POLICY_REASON_LABELS[code as PolicyReason] ?? code}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">
          Andamento
        </h2>
        {request.events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Recebida. O andamento aparece aqui assim que a triagem começar.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {request.events.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="text-foreground font-medium">
                  {FISCAL_STATUS_LABELS[e.toStatus] ?? e.toStatus}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {date(e.createdAt)}
                </span>
                {e.reason ? (
                  <p className="text-muted-foreground">{e.reason}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </Container>
  );
}
