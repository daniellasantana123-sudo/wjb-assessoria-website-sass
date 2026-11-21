import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/wjb-ai/print-button";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { FISCAL_STATUS_LABELS, formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";
import { getFiscalRequest } from "@/lib/wjb-ai/fiscal/requests.repo";

export const metadata: Metadata = {
  title: "Prévia da solicitação (simulação)",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Prévia imprimível da solicitação (Fase 7). É SEMPRE marcada como
 * simulação sem valor fiscal: não existe conector oficial nesta fase. O
 * documento do tomador sai mascarado; só a empresa dona do pedido acessa.
 */
export default async function PortalNfsePreviewPage({
  params,
}: PageProps<"/portal/nfse/[id]/previa">) {
  if (!isWjbAiEnabled()) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) notFound();
  const r = await getFiscalRequest(tenant.id, id);
  if (!r) notFound();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-12 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/portal/nfse/${id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Voltar para a solicitação
        </Link>
        <PrintButton />
      </div>

      <article
        aria-labelledby="titulo-previa"
        className="border-danger/60 relative overflow-hidden rounded-md border-2 border-dashed p-6 sm:p-8"
      >
        <p
          aria-hidden="true"
          className="text-danger/10 pointer-events-none absolute inset-0 flex -rotate-[20deg] items-center justify-center text-center text-4xl font-black tracking-widest select-none sm:text-6xl"
        >
          SIMULAÇÃO
          <br />
          SEM VALOR FISCAL
        </p>
        <div className="relative flex flex-col gap-5">
          <p
            role="note"
            className="bg-danger/10 text-danger rounded-md px-4 py-3 text-sm font-semibold"
          >
            SIMULAÇÃO - SEM VALOR FISCAL. Este documento não é uma NFS-e e não
            pode ser usado como comprovante. Nenhuma nota foi transmitida ao
            governo.
          </p>
          <header>
            <h1
              id="titulo-previa"
              className="text-foreground text-xl font-semibold"
            >
              Prévia da solicitação de NFS-e
            </h1>
            <p className="text-muted-foreground text-sm">
              {tenant.name} · situação:{" "}
              {r.simulated
                ? `${FISCAL_STATUS_LABELS[r.status]} (simulação)`
                : FISCAL_STATUS_LABELS[r.status]}
            </p>
          </header>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Serviço</dt>
              <dd className="text-foreground">{r.draft.serviceDescription}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="text-foreground">
                {formatCents(r.draft.amountCents)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Competência</dt>
              <dd className="text-foreground">{r.draft.competence}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tomador</dt>
              <dd className="text-foreground">
                {r.draft.taker.name} ({r.draft.taker.documentKind}{" "}
                {maskDocument(r.draft.taker.document)})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Identificação interna</dt>
              <dd className="text-foreground font-mono text-xs">{r.id}</dd>
            </div>
            {r.simulatedReference ? (
              <div>
                <dt className="text-muted-foreground">
                  Referência da simulação
                </dt>
                <dd className="text-foreground font-mono text-xs">
                  {r.simulatedReference} (não é chave de acesso)
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </article>
    </Container>
  );
}
