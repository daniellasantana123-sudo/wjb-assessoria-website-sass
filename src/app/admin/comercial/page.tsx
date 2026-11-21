import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  adminSubscriptionStatusAction,
  saveComboDiscountAction,
  saveCostPremisesAction,
  savePlanAction,
  setRelationshipAction,
} from "@/actions/commercial";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { requireStaffSession } from "@/lib/auth/dal";
import { isCommercialEnabled } from "@/lib/commercial/config";
import { formatBrlCents, marginAt } from "@/lib/commercial/pricing";
import { getComboDiscountBp, getCostPremises, listCatalog, listSubscriptionsForAdmin } from "@/lib/commercial/repo";

export const metadata: Metadata = { title: "Comercial", robots: { index: false, follow: false } };

const toReais = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

function PlanFields({ id, p }: { id: string; p?: { name: string; description: string; monthlyCents: number | null; quota: number | null; overageCents: number | null; status: string } }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5"><Label htmlFor={`n-${id}`}>Nome</Label><Input id={`n-${id}`} name="name" defaultValue={p?.name} required /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`m-${id}`}>Mensalidade (R$; vazio = sob proposta)</Label><Input id={`m-${id}`} name="monthly" inputMode="decimal" defaultValue={toReais(p?.monthlyCents ?? null)} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`q-${id}`}>Franquia (notas/mês; vazio = sem)</Label><Input id={`q-${id}`} name="quota" inputMode="numeric" defaultValue={p?.quota ?? ""} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`o-${id}`}>Excedente ou valor por nota (R$)</Label><Input id={`o-${id}`} name="overage" inputMode="decimal" defaultValue={toReais(p?.overageCents ?? null)} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`s-${id}`}>Situação</Label>
        <Select id={`s-${id}`} name="status" defaultValue={p?.status ?? "draft"}><option value="draft">Rascunho</option><option value="archived">Arquivado</option></Select></div>
      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1"><Label htmlFor={`d-${id}`}>Descrição</Label><Input id={`d-${id}`} name="description" defaultValue={p?.description} /></div>
    </div>
  );
}

/** Catálogo, descontos, relações e assinaturas (Fase 8, simulação). */
export default async function AdminComercialPage() {
  if (!isCommercialEnabled()) notFound();
  const session = await requireStaffSession();
  const canEdit = session.staffRole === "super_admin";
  const [catalog, combo, premises, admin] = await Promise.all([listCatalog(true), getComboDiscountBp(), getCostPremises(), listSubscriptionsForAdmin()]);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Comercial" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">Comercial</h1>
        <Badge tone="warning">Simulação: preços em rascunho, sem cobrança</Badge>
      </div>
      {!canEdit ? <p className="text-muted-foreground text-sm">Somente leitura: catálogo, preços e descontos são alterados pelo super admin.</p> : null}

      <section aria-labelledby="catalogo" className="flex flex-col gap-4">
        <h2 id="catalogo" className="text-foreground text-lg font-semibold">Catálogo de planos de emissão</h2>
        <p className="text-muted-foreground text-sm">Nesta fase o plano só pode ser rascunho ou arquivado. Toda alteração gera nova versão e histórico no banco.</p>
        <ul className="flex flex-col gap-3">
          {catalog.map((p) => (
            <li key={p.id} className="border-border rounded-md border p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{p.name}</strong>
                <code className="text-muted-foreground">{p.sku}</code>
                <Badge tone={p.status === "draft" ? "warning" : "neutral"}>{p.status === "draft" ? "rascunho" : "arquivado"}</Badge>
                <span className="text-muted-foreground">v{p.version} · {formatBrlCents(p.monthlyCents)} · {p.quota === null ? "sem franquia" : `${p.quota} notas`} · {p.overageCents === null ? "contratual" : `${formatBrlCents(p.overageCents)}/nota`}</span>
              </div>
              {canEdit ? (
                <details className="mt-2">
                  <summary className="text-primary cursor-pointer text-sm">Editar</summary>
                  <div className="mt-3">
                    <AdminActionForm action={savePlanAction.bind(null, p.id)} submitLabel="Salvar rascunho" variant="outline" resetOnSuccess={false}>
                      <PlanFields id={p.id} p={p} />
                    </AdminActionForm>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <details className="border-border rounded-md border p-4">
            <summary className="text-primary cursor-pointer text-sm font-medium">Novo plano (rascunho)</summary>
            <div className="mt-3">
              <AdminActionForm action={savePlanAction.bind(null, null)} submitLabel="Criar rascunho" variant="outline">
                <div className="flex flex-col gap-1.5 sm:max-w-xs"><Label htmlFor="sku-novo">Código (sku)</Label><Input id="sku-novo" name="sku" required /></div>
                <PlanFields id="novo" />
              </AdminActionForm>
            </div>
          </details>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="combo" className="border-border min-w-0 rounded-md border p-4">
          <h2 id="combo" className="text-foreground mb-2 font-semibold">Desconto do combo (cliente de contabilidade)</h2>
          <p className="text-muted-foreground mb-3 text-sm">Atual: {combo / 100}%. Vale só sobre a mensalidade do plano de emissão, nas novas contratações. Máximo 50%.</p>
          {canEdit ? (
            <AdminActionForm action={saveComboDiscountAction} submitLabel="Salvar" variant="outline" resetOnSuccess={false}>
              <div className="flex flex-col gap-1.5 sm:max-w-xs"><Label htmlFor="pct">Desconto (%)</Label><Input id="pct" name="percent" inputMode="decimal" defaultValue={String(combo / 100)} /></div>
            </AdminActionForm>
          ) : null}
        </section>
        <section aria-labelledby="custo" className="border-border min-w-0 rounded-md border p-4">
          <h2 id="custo" className="text-foreground mb-2 font-semibold">Premissas de custo (análise de margem)</h2>
          <p className="text-muted-foreground mb-3 text-sm">Definidas pela WJB. Sem elas, a margem não é calculada.</p>
          {canEdit ? (
            <AdminActionForm action={saveCostPremisesAction} submitLabel="Salvar premissas" variant="outline" resetOnSuccess={false}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="cpn">Custo variável por nota (R$)</Label><Input id="cpn" name="costPerNote" inputMode="decimal" defaultValue={toReais(premises.costPerNoteCents)} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="cfc">Custo fixo por cliente/mês (R$)</Label><Input id="cfc" name="fixedPerClient" inputMode="decimal" defaultValue={toReais(premises.fixedCostPerClientCents)} /></div>
              </div>
            </AdminActionForm>
          ) : null}
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Margem estimada por volume de notas">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <caption className="sr-only">Margem estimada por plano com a franquia toda usada</caption>
              <thead className="text-muted-foreground text-xs"><tr><th className="py-1 pr-2 font-medium">Plano</th><th className="py-1 pr-2 font-medium">Receita</th><th className="py-1 pr-2 font-medium">Custo</th><th className="py-1 font-medium">Margem</th></tr></thead>
              <tbody>
                {catalog.filter((p) => p.status === "draft").map((p) => {
                  const m = marginAt(p, p.quota ?? 10, 0, premises);
                  return (
                    <tr key={p.id} className="border-border border-t">
                      <td className="py-1 pr-2">{p.name}</td>
                      {m.defined ? (<><td className="py-1 pr-2">{formatBrlCents(m.revenueCents)}</td><td className="py-1 pr-2">{formatBrlCents(m.costCents)}</td><td className="py-1">{formatBrlCents(m.marginCents)}{m.marginPct !== null ? ` (${m.marginPct}%)` : ""}</td></>) : (<td colSpan={3} className="text-muted-foreground py-1">Premissas de custo não definidas</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section aria-labelledby="empresas" className="flex flex-col gap-3">
        <h2 id="empresas" className="text-foreground text-lg font-semibold">Relação comercial das empresas</h2>
        <ul className="border-border divide-border divide-y rounded-md border">
          {admin.tenants.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 break-words">{t.name} · {t.relationship === "contabilidade" ? "contabilidade" : t.relationship === "somente_emissao" ? "somente emissão" : "não definida"}</span>
              {canEdit ? (
                <AdminActionForm action={setRelationshipAction.bind(null, t.id)} submitLabel="Salvar" variant="outline" resetOnSuccess={false}>
                  <Label htmlFor={`rel-${t.id}`} className="sr-only">Relação de {t.name}</Label>
                  <Select id={`rel-${t.id}`} name="relationship" defaultValue={t.relationship ?? ""}>
                    <option value="" disabled>Selecione</option>
                    <option value="contabilidade">Contabilidade (combo possível)</option>
                    <option value="somente_emissao">Somente emissão</option>
                  </Select>
                </AdminActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="assinaturas" className="flex flex-col gap-3">
        <h2 id="assinaturas" className="text-foreground text-lg font-semibold">Assinaturas (simulação)</h2>
        {admin.subscriptions.length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma assinatura.</p> : (
          <ul className="border-border divide-border divide-y rounded-md border">
            {admin.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 break-words">
                  <strong>{s.tenantName}</strong> · {s.sku} · {s.used}{s.quota !== null ? `/${s.quota}` : ""} notas simuladas no ciclo
                  {s.discountBp ? ` · desconto ${s.discountBp / 100}%` : ""} <Badge tone={s.status === "ativa_simulada" ? "success" : "neutral"}>{s.status.replace("_", " ")}</Badge>
                </span>
                {canEdit && s.status !== "cancelada" ? (
                  <AdminActionForm action={adminSubscriptionStatusAction.bind(null, s.id)} submitLabel={s.status === "suspensa" ? "Reativar" : "Suspender"} variant="outline" resetOnSuccess={false}>
                    <input type="hidden" name="status" value={s.status === "suspensa" ? "ativa_simulada" : "suspensa"} />
                  </AdminActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
