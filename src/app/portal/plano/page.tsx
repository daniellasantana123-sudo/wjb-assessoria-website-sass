import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  cancelSubscriptionAction,
  contractPlanAction,
  overageSettingsAction,
  schedulePlanChangeAction,
} from "@/actions/commercial";
import { cancelPaidSubscriptionAction, cancelPendingCheckoutAction, openBillingPortalAction, startCheckoutAction } from "@/actions/payments";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { requireSession } from "@/lib/auth/dal";
import { getCommercialWhatsAppLink } from "@/integrations/whatsapp";
import { isCommercialEnabled } from "@/lib/commercial/config";
import {
  ACCEPTANCE_DOCUMENTS,
  comboDiscountBp,
  formatBrlCents,
  invoicePreview,
  isPerNotePlan,
  monthlyWithDiscount,
  usageSummary,
  type AcceptanceDocument,
} from "@/lib/commercial/pricing";
import { getComboDiscountBp, getTenantCommercial, listCatalog, listTenantInvoices } from "@/lib/commercial/repo";
import { getPaymentsStatus } from "@/lib/payments/config";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Plano de emissão", robots: { index: false, follow: false } };

const STATUS = {
  ativa_simulada: "Ativa (simulação)",
  pendente_pagamento: "Aguardando pagamento",
  ativa_teste: "Ativa (pagamento de teste)",
  inadimplente: "Pagamento em atraso",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
} as Record<string, string>;
const INVOICE_STATUS: Record<string, string> = { rascunho: "Rascunho", aberta: "Em aberto", paga: "Paga", incobravel: "Não cobrável", anulada: "Anulada" };
const brDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const ALERT = {
  nenhum: null,
  "80": "Você usou 80% da franquia do mês.",
  "100": "A franquia do mês acabou. Novos pedidos dependem do excedente autorizado.",
  excedente: "Você está no excedente da franquia (simulação, sem cobrança).",
} as const;

/** Plano e consumo da empresa (Fase 8, simulação). Desligado por padrão. */
export default async function PortalPlanoPage({ searchParams }: PageProps<"/portal/plano">) {
  if (!isCommercialEnabled()) notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) notFound();
  const [c, catalog, comboBp] = await Promise.all([getTenantCommercial(tenant.id), listCatalog(), getComboDiscountBp()]);
  const isOwner = tenant.role === "owner";
  const isAccounting = c.relationship === "contabilidade";
  const discount = comboDiscountBp(isAccounting, comboBp);
  const sub = c.subscription;
  const used = c.usedSimulated + c.usedBillable;
  const usage = sub ? usageSummary(sub.quota, used) : null;
  const invoice = sub ? invoicePreview(sub, c.usedBillable, c.usedSimulated, sub.planName) : null;
  const emissionPlans = catalog.filter((p) => p.product === "emissao");
  const sp = await searchParams;
  const payments = getPaymentsStatus();
  const paymentsOn = payments.enabled;
  const paid = !!sub && (sub.mode === "stripe_test" || sub.providerSubscriptionId !== null || ["pendente_pagamento", "ativa_teste", "inadimplente"].includes(sub.status));
  const invoices = paymentsOn && sub ? await listTenantInvoices(tenant.id) : [];

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Plano" }]} />
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Plano de emissão de notas</h1>
        <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>
      </div>
      {sp.contratado === "1" && sub ? (
        <p role="status" className="border-success/40 bg-success/10 rounded-md border px-4 py-3 text-sm font-medium">
          Plano {sub.planName ?? sub.sku} contratado em SIMULAÇÃO. Nenhuma cobrança foi feita.
        </p>
      ) : null}
      {sp.cancelado === "1" && !sub ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          Plano cancelado (simulação). O histórico e os documentos continuam disponíveis.
        </p>
      ) : null}
      {paymentsOn ? (
        <div role="note" className="border-danger/40 bg-danger/5 rounded-md border px-4 py-3 text-sm">
          <strong>PAGAMENTO SIMULADO / AMBIENTE DE TESTE.</strong>{" "}
          {payments.provider === "stripe_test"
            ? "O pagamento usa a Stripe em modo de teste: só cartões de teste funcionam e nenhum dinheiro é cobrado."
            : "O pagamento é simulado: nenhum dado de cartão é pedido e nenhum dinheiro é cobrado."}{" "}
          O acesso só é liberado quando o servidor confirma o pagamento, nunca pela página de retorno.
        </div>
      ) : null}
      {sp.pagamento === "retorno" ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          {sub?.status === "ativa_teste"
            ? "Pagamento confirmado (ambiente de teste). Seu plano está ativo."
            : "Recebemos o retorno do pagamento. O plano é ativado quando o provedor confirmar, normalmente em segundos: atualize a página."}
        </p>
      ) : null}
      {sp.pagamento === "cancelado" ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          Pagamento não concluído. Nada foi cobrado. Você pode tentar de novo ou desistir.
        </p>
      ) : null}
      {sp.pagamento === "desistiu" ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          Tentativa de pagamento encerrada. Nada foi cobrado.
        </p>
      ) : null}
      {sp.portal === "simulado" ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          No pagamento simulado não há portal de cobrança. Com a Stripe, este botão abre o portal dela para trocar o cartão.
        </p>
      ) : null}
      <div role="note" className="border-warning/40 bg-warning/10 rounded-md border px-4 py-3 text-sm">
        <strong>Contratação em simulação.</strong> Os valores são os aprovados pela WJB, mas a cobrança ainda não está ativa e a
        emissão oficial de notas ainda não está disponível: nada é cobrado. O emissor público de NFS-e é gratuito: a WJB cobra pela
        conveniência, organização, suporte e automação do serviço.
      </div>

      {!sub ? (
        <section aria-labelledby="planos" className="flex flex-col gap-4">
          <h2 id="planos" className="text-foreground text-lg font-semibold">Escolha um plano</h2>
          {isAccounting && discount ? (
            <p className="text-sm">
              Como cliente de contabilidade da WJB, sua empresa tem <strong>{discount / 100}% de desconto</strong> na mensalidade
              do plano de emissão (não vale para nota avulsa, excedente ou honorários). Sua conta e seus acessos atuais continuam.
            </p>
          ) : null}
          {emissionPlans.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum plano disponível no momento.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {emissionPlans.map((p) => {
                const price = monthlyWithDiscount(p, discount);
                return (
                  <li key={p.id} className="border-border flex min-w-0 flex-col gap-3 rounded-md border p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-foreground font-semibold">{p.name}</h3>
                      <Badge tone="info">valor aprovado</Badge>
                    </div>
                    {p.description ? <p className="text-muted-foreground text-sm">{p.description}</p> : null}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Mensalidade</dt>
                      <dd>
                        {formatBrlCents(price)}
                        {price !== p.monthlyCents && p.monthlyCents !== null ? (
                          <span className="text-muted-foreground line-through"> {formatBrlCents(p.monthlyCents)}</span>
                        ) : null}
                      </dd>
                      <dt className="text-muted-foreground">Franquia</dt>
                      <dd>{p.monthlyCents === null ? "Contratual" : isPerNotePlan(p) ? "Sem franquia" : `${p.quota} notas/mês`}</dd>
                      <dt className="text-muted-foreground">{isPerNotePlan(p) ? "Por nota" : "Excedente"}</dt>
                      <dd>{p.overageCents === null ? "Contratual" : `${formatBrlCents(p.overageCents)}/nota`}</dd>
                    </dl>
                    {p.monthlyCents === null || p.overageCents === null ? (
                      <a
                        href={getCommercialWhatsAppLink("altoVolume") ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-analytics-location="portal-plano-alto-volume"
                        className="text-primary text-sm font-medium underline"
                      >
                        Pedir proposta pelo WhatsApp<span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : isOwner ? (
                      <details>
                        <summary className="text-primary cursor-pointer text-sm font-medium">
                          {paymentsOn ? "Contratar (pagamento de teste)" : "Contratar (simulação)"}
                        </summary>
                        <div className="mt-3">
                          {paymentsOn ? (
                            <p className="text-muted-foreground mb-2 text-xs">
                              {isPerNotePlan(p)
                                ? "Você cadastra a forma de pagamento; nada é cobrado agora. Só nota oficialmente autorizada é cobrada, quando o serviço for liberado."
                                : `Você será levado ao pagamento de ${formatBrlCents(price)} por mês (ambiente de teste). Notas adicionais só com sua autorização.`}
                            </p>
                          ) : null}
                          <AdminActionForm
                            action={paymentsOn ? startCheckoutAction : contractPlanAction}
                            submitLabel={paymentsOn ? (isPerNotePlan(p) ? "Cadastrar forma de pagamento (teste)" : "Ir para o pagamento (teste)") : "Contratar em simulação"}
                            pendingLabel={paymentsOn ? "Abrindo o pagamento..." : "Salvando..."}
                            resetOnSuccess={false}
                          >
                            <input type="hidden" name="sku" value={p.sku} />
                            <fieldset className="flex flex-col gap-2">
                              <legend className="text-foreground mb-1 text-sm font-medium">Aceites (cada um é registrado)</legend>
                              {(Object.keys(ACCEPTANCE_DOCUMENTS) as AcceptanceDocument[]).map((d) => (
                                <label key={d} className="flex items-start gap-2 text-sm">
                                  <input type="checkbox" name={`aceite_${d}`} className="mt-1 size-4" required />
                                  <span>{ACCEPTANCE_DOCUMENTS[d].label}</span>
                                </label>
                              ))}
                            </fieldset>
                          </AdminActionForm>
                        </div>
                      </details>
                    ) : (
                      <p className="text-muted-foreground text-xs">Só o responsável pela empresa pode contratar.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          <section aria-labelledby="atual" className="border-border flex flex-col gap-3 rounded-md border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="atual" className="text-foreground text-lg font-semibold">{sub.planName ?? sub.sku}</h2>
              <Badge tone={sub.status === "ativa_simulada" || sub.status === "ativa_teste" ? "success" : "warning"}>{STATUS[sub.status]}</Badge>
            </div>
            {sub.status === "pendente_pagamento" ? (
              <div role="status" className="border-warning/40 bg-warning/10 rounded-md border p-3 text-sm">
                <p>
                  <strong>Pagamento em andamento.</strong> O plano só é ativado quando o pagamento for confirmado pelo servidor.
                  Se você saiu da página de pagamento, pode desistir e escolher de novo.
                </p>
                {isOwner ? (
                  <div className="mt-2">
                    <AdminActionForm action={cancelPendingCheckoutAction} submitLabel="Desistir deste pagamento" variant="outline" resetOnSuccess={false} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {sub.status === "inadimplente" ? (
              <p role="alert" className="border-danger/40 bg-danger/5 rounded-md border p-3 text-sm">
                <strong>O pagamento da renovação falhou.</strong> Novos pedidos de nota ficam bloqueados até a regularização. Atualize a
                forma de pagamento. A contabilidade, se contratada, não é afetada.
              </p>
            ) : null}
            {paid && sub.currentPeriodEnd ? (
              <p className="text-muted-foreground text-sm">
                {sub.cancelAtPeriodEnd ? `Cancelamento agendado: o plano termina em ${brDate(sub.currentPeriodEnd)}.` : `Período pago até ${brDate(sub.currentPeriodEnd)}.`}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">
              Ciclo de {sub.cycleStart.split("-").reverse().join("/")} a {sub.cycleEnd.split("-").reverse().join("/")}
              {sub.discountBp ? ` · desconto de cliente de contabilidade ${sub.discountBp / 100}% na mensalidade` : ""}
            </p>
            {usage ? (
              <div>
                <p className="text-sm">
                  Notas no ciclo: <strong>{usage.used}</strong>
                  {usage.quota ? ` de ${usage.quota}` : " (sem franquia, cobrança por nota)"} <Badge tone="info">simuladas</Badge>
                </p>
                {usage.percent !== null ? (
                  <div
                    role="progressbar"
                    aria-label="Uso da franquia"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, usage.percent)}
                    className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full"
                  >
                    <div className={`h-full ${usage.alert === "nenhum" ? "bg-primary" : "bg-warning"}`} style={{ width: `${Math.min(100, usage.percent)}%` }} />
                  </div>
                ) : null}
                {ALERT[usage.alert] ? <p role="status" className="text-warning-text mt-2 text-sm font-medium">{ALERT[usage.alert]}</p> : null}
              </div>
            ) : null}
            {invoice ? (
              <div className="bg-muted/30 rounded-md p-3 text-sm">
                <p className="text-foreground font-medium">Prévia da fatura do ciclo</p>
                <ul className="mt-1">
                  {invoice.lines.map((l) => (
                    <li key={l.label} className="flex items-start justify-between gap-3"><span className="min-w-0">{l.label}</span><span className="shrink-0 tabular-nums whitespace-nowrap">{formatBrlCents(l.cents)}</span></li>
                  ))}
                  <li className="border-border mt-1 flex justify-between gap-3 border-t pt-1 font-semibold"><span>Total</span><span className="shrink-0 tabular-nums whitespace-nowrap">{formatBrlCents(invoice.totalCents)}</span></li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">{invoice.note}</p>
              </div>
            ) : null}
          </section>

          {isOwner && sub.status !== "cancelada" && sub.status !== "pendente_pagamento" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {!isPerNotePlan(sub) ? (
              <section aria-labelledby="excedente" className="border-border min-w-0 rounded-md border p-5">
                <h2 id="excedente" className="text-foreground mb-2 font-semibold">Excedente</h2>
                <p className="text-muted-foreground mb-3 text-sm">
                  Sem autorização, ao atingir a franquia os pedidos param. Com autorização, cada nota extra custa{" "}
                  {formatBrlCents(sub.overageCents)} até o limite que você definir.
                </p>
                <AdminActionForm action={overageSettingsAction} submitLabel="Salvar" variant="outline" resetOnSuccess={false}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="authorized" defaultChecked={sub.overageAuthorized} className="size-4" />
                    Autorizo notas além da franquia
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="limit">Limite de gasto com excedente no mês (R$)</Label>
                    <Input id="limit" name="limit" inputMode="decimal" defaultValue={sub.spendingLimitCents !== null ? (sub.spendingLimitCents / 100).toFixed(2).replace(".", ",") : ""} />
                  </div>
                </AdminActionForm>
              </section>
              ) : null}
              {paid ? (
                <section aria-labelledby="forma-pagamento" className="border-border min-w-0 rounded-md border p-5">
                  <h2 id="forma-pagamento" className="text-foreground mb-2 font-semibold">Forma de pagamento</h2>
                  <p className="text-muted-foreground mb-3 text-sm">
                    Troca de cartão e histórico de cobranças ficam no portal seguro do provedor de pagamento. A WJB não guarda dados de
                    cartão. Troca de plano: fale com a equipe.
                  </p>
                  <AdminActionForm action={openBillingPortalAction} submitLabel="Gerenciar forma de pagamento" variant="outline" resetOnSuccess={false} />
                </section>
              ) : (
              <section aria-labelledby="troca" className="border-border min-w-0 rounded-md border p-5">
                <h2 id="troca" className="text-foreground mb-2 font-semibold">Trocar de plano</h2>
                <AdminActionForm action={schedulePlanChangeAction} submitLabel="Agendar troca" variant="outline" resetOnSuccess={false}>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="novo-plano">Novo plano (vale no próximo ciclo)</Label>
                    <Select id="novo-plano" name="sku" defaultValue="">
                      <option value="">Selecione</option>
                      {emissionPlans.filter((p) => p.id !== sub.planId).map((p) => (
                        <option key={p.id} value={p.sku}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                </AdminActionForm>
                {sub.pendingPlanId ? <p className="text-muted-foreground mt-2 text-xs">Há uma troca agendada para o próximo ciclo.</p> : null}
              </section>
              )}
              {paid ? (
                <section aria-labelledby="cancelar" className="border-border min-w-0 rounded-md border p-5">
                  <h2 id="cancelar" className="text-foreground mb-2 font-semibold">Cancelar</h2>
                  <AdminActionForm action={cancelPaidSubscriptionAction} submitLabel="Cancelar no fim do período" variant="outline" resetOnSuccess={false}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="confirm" className="mt-1 size-4" required />
                      O plano continua até o fim do período já pago; depois, novos pedidos param e o histórico continua disponível.
                    </label>
                  </AdminActionForm>
                </section>
              ) : (
              <section aria-labelledby="cancelar" className="border-border min-w-0 rounded-md border p-5">
                <h2 id="cancelar" className="text-foreground mb-2 font-semibold">Cancelar</h2>
                <AdminActionForm action={cancelSubscriptionAction} submitLabel="Cancelar plano" variant="outline">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="motivo">Motivo</Label>
                    <Input id="motivo" name="reason" minLength={5} required />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="confirm" className="mt-1 size-4" required />
                    Entendo que novos pedidos param e que o histórico continua disponível.
                  </label>
                </AdminActionForm>
              </section>
              )}
            </div>
          ) : null}

          {paymentsOn && paid ? (
            <section aria-labelledby="faturas" className="flex flex-col gap-2 text-sm">
              <h2 id="faturas" className="text-foreground font-semibold">Faturas (ambiente de teste)</h2>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma fatura ainda.</p>
              ) : (
                <ul className="border-border divide-border divide-y rounded-md border">
                  {invoices.map((f) => (
                    <li key={f.provider_invoice_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="min-w-0">
                        {brDate(f.period_start)} a {brDate(f.period_end)} · <strong className="tabular-nums">{formatBrlCents(f.amount_due_cents)}</strong>
                        {f.amount_refunded_cents ? ` · estornado ${formatBrlCents(f.amount_refunded_cents)}` : ""}
                        {f.disputed ? " · em contestação" : ""}
                      </span>
                      <span className="flex items-center gap-3">
                        <Badge tone={f.status === "paga" ? "success" : f.status === "aberta" ? "warning" : "neutral"}>{INVOICE_STATUS[f.status] ?? f.status}</Badge>
                        {f.hosted_invoice_url ? (
                          <a href={f.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            Ver fatura<span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {c.acceptances.length ? (
            <section aria-labelledby="aceites" className="text-sm">
              <h2 id="aceites" className="text-foreground mb-1 font-semibold">Aceites registrados</h2>
              <ul className="text-muted-foreground list-disc pl-5">
                {c.acceptances.map((a) => (
                  <li key={a.document}>
                    {ACCEPTANCE_DOCUMENTS[a.document as AcceptanceDocument]?.label ?? a.document} · versão {a.version} ·{" "}
                    {new Date(a.acceptedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}
