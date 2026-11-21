import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  assignReviewAction,
  authorizeSendAction,
  releaseInterventionAction,
  reviewRequestAction,
} from "@/actions/wjb-ai-admin";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { FiscalStatusBadge } from "@/components/wjb-ai/fiscal-status-badge";
import { requireStaffSession } from "@/lib/auth/dal";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import {
  getAdminRequest,
  listReviewStaff,
} from "@/lib/wjb-ai/fiscal/admin.repo";
import {
  diffDrafts,
  isPriority,
  PRIORITIES,
  slaState,
} from "@/lib/wjb-ai/fiscal/review-queue";
import { FISCAL_STATUS_LABELS, formatCents } from "@/lib/wjb-ai/fiscal/labels";
import {
  POLICY_REASON_LABELS,
  type PolicyReason,
} from "@/lib/wjb-ai/fiscal/policy";
import { REVIEW_DECISION_LABELS } from "@/lib/wjb-ai/fiscal/review";
import { hasWjbAiPermission } from "@/lib/wjb-ai/permissions";

export const metadata: Metadata = {
  title: "Solicitação de NFS-e",
  robots: { index: false, follow: false },
};
const UUID = /^[0-9a-f-]{36}$/i;
const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

export default async function AdminNfseDetailPage({
  params,
}: PageProps<"/admin/nfse/[id]">) {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const r = await getAdminRequest(id);
  if (!r) notFound();
  const canReview = hasWjbAiPermission(session, "fiscal.review");
  const d = r.draft;
  const staff = canReview ? await listReviewStaff() : [];
  const assigneeName = staff.find((s) => s.id === r.assignedTo)?.name ?? null;
  const priority = isPriority(r.priority) ? r.priority : "normal";
  const sla = slaState(r.reviewDueAt, priority, new Date());
  // Versões: v1..vN guardadas na correção + versão atual. Diferença de cada passo.
  const chain = [
    ...r.versions.map((v) => ({
      label: `versão ${v.version}`,
      draft: v.draft,
      at: v.replacedAt,
    })),
    { label: "atual", draft: r.draft, at: null as string | null },
  ];
  const steps = chain
    .slice(1)
    .map((cur, i) => ({
      from: chain[i].label,
      to: cur.label,
      at: chain[i].at,
      changes: diffDrafts(chain[i].draft, cur.draft),
    }));

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "NFS-e", href: "/admin/nfse" },
          { label: "Solicitação" },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">
          {r.tenantName}
        </h1>
        <div className="flex gap-2">
          {r.needsIntervention ? (
            <Badge tone="danger">Fila de erros</Badge>
          ) : null}
          <FiscalStatusBadge
            status={r.status}
            simulated={r.attempts.every((a) => a.simulated !== false)}
          />
        </div>
      </div>

      <section className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">
          Dados da solicitação
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Pedido por</dt>
            <dd>
              {r.createdByName} em {when(r.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Competência</dt>
            <dd>{d.competence}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd className="break-words">{d.serviceDescription}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor</dt>
            <dd>{formatCents(d.amountCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tomador</dt>
            <dd className="break-words">
              {d.taker.name} · {d.taker.documentKind} {d.taker.document}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Perfil fiscal aprovado</dt>
            <dd>
              {r.approvedProfileVersion
                ? `versão ${r.approvedProfileVersion}`
                : "não há"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Autorização de emissão</dt>
            <dd>
              {r.grantValidUntil
                ? `válida até ${r.grantValidUntil.split("-").reverse().join("/")}`
                : "não há"}
            </dd>
          </div>
        </dl>
        {r.policyReasons.length ? (
          <ul className="text-muted-foreground mt-4 list-disc pl-5 text-sm">
            {r.policyReasons.map((c) => (
              <li key={c}>{POLICY_REASON_LABELS[c as PolicyReason] ?? c}</li>
            ))}
          </ul>
        ) : null}
        {r.lastError ? (
          <p className="text-danger mt-3 text-sm">
            Último erro: {r.lastError} (tentativas: {r.attemptCount})
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="atribuicao"
        className="border-border rounded-md border p-6"
      >
        <h2
          id="atribuicao"
          className="text-foreground mb-2 text-sm font-semibold"
        >
          Atribuição e prazo
        </h2>
        <p className="text-muted-foreground text-sm">
          Responsável:{" "}
          {assigneeName ?? (r.assignedTo ? "membro da equipe" : "ninguém")} ·
          prioridade {PRIORITIES[priority].label.toLowerCase()}
          {r.reviewDueAt ? ` · prazo ${when(r.reviewDueAt)}` : ""}{" "}
          {sla === "vencido" ? (
            <Badge tone="danger">prazo vencido</Badge>
          ) : sla === "vence_logo" ? (
            <Badge tone="warning">vence logo</Badge>
          ) : null}
        </p>
        {canReview ? (
          <div className="mt-3">
            <AdminActionForm
              action={assignReviewAction.bind(null, r.id)}
              submitLabel="Salvar atribuição"
              variant="outline"
              resetOnSuccess={false}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="assignedTo">Responsável</Label>
                  <Select
                    id="assignedTo"
                    name="assignedTo"
                    defaultValue={r.assignedTo ?? ""}
                  >
                    <option value="">Ninguém</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="priority">
                    Prioridade (define o prazo da revisão)
                  </Label>
                  <Select id="priority" name="priority" defaultValue={priority}>
                    {Object.entries(PRIORITIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} ({v.hours} h)
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </AdminActionForm>
          </div>
        ) : null}
      </section>

      {steps.length ? (
        <section
          aria-labelledby="versoes"
          className="border-border rounded-md border p-6"
        >
          <h2
            id="versoes"
            className="text-foreground mb-3 text-sm font-semibold"
          >
            O que mudou nas correções
          </h2>
          <ol className="flex flex-col gap-4 text-sm">
            {steps.map((st) => (
              <li key={st.to}>
                <p className="text-foreground font-medium">
                  {st.from} → {st.to}
                  {st.at ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      (corrigido em {when(st.at)})
                    </span>
                  ) : null}
                </p>
                {st.changes.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum campo mudou.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="mt-1 w-full min-w-[28rem] text-left">
                      <thead className="text-muted-foreground text-xs">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Campo</th>
                          <th className="py-1 pr-3 font-medium">Antes</th>
                          <th className="py-1 font-medium">Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {st.changes.map((c) => (
                          <tr key={c.field} className="border-border border-t">
                            <td className="py-1 pr-3">{c.field}</td>
                            <td className="text-muted-foreground py-1 pr-3 break-words line-through">
                              {c.before}
                            </td>
                            <td className="py-1 break-words">{c.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {canReview && r.status === "REVISAO_HUMANA" ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">
            Revisão do contador
          </h2>
          <AdminActionForm
            action={reviewRequestAction.bind(null, r.id)}
            submitLabel="Registrar decisão"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="decision">Decisão</Label>
              <Select id="decision" name="decision" defaultValue="approve">
                {Object.entries(REVIEW_DECISION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">
                Observação (obrigatória para pedir correção ou bloquear; o
                cliente vê)
              </Label>
              <Textarea id="note" name="note" rows={3} />
            </div>
          </AdminActionForm>
        </section>
      ) : null}

      {canReview && r.status === "CONFIRMADA" ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-2 text-sm font-semibold">Envio</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Exige perfil fiscal aprovado e autorização de emissão válida. Nesta
            fase o envio é sempre SIMULADO.
          </p>
          <AdminActionForm
            action={authorizeSendAction.bind(null, r.id)}
            submitLabel="Autorizar envio simulado"
            variant="cta"
          />
        </section>
      ) : null}

      {canReview && r.needsIntervention ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-2 text-sm font-semibold">
            Fila de erros
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            O processamento parou depois do limite de tentativas. Ao devolver à
            fila, o resultado é consultado antes de qualquer reenvio.
          </p>
          <AdminActionForm
            action={releaseInterventionAction.bind(null, r.id)}
            submitLabel="Devolver à fila"
            variant="outline"
          />
        </section>
      ) : null}

      <section className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">
          Histórico completo
        </h2>
        <ol className="flex flex-col gap-3">
          {r.events.map((e, i) => (
            <li key={i} className="text-sm">
              <span className="text-foreground font-medium">
                {FISCAL_STATUS_LABELS[e.to] ?? e.to}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {e.actor} · {when(e.at)}
              </span>
              {e.reason ? (
                <p className="text-muted-foreground">{e.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {r.attempts.length ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">
            Tentativas de envio
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {r.attempts.map((a, i) => (
              <li key={i}>
                {a.simulated ? <Badge tone="warning">SIMULADO</Badge> : null}{" "}
                {a.outcome} · {a.environment}
                {a.official_reference ? ` · ${a.official_reference}` : ""}
                {a.rejection_code ? ` · ${a.rejection_code}` : ""} ·{" "}
                {when(a.created_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
