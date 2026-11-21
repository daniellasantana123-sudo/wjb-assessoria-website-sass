import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { adminMockEventAction, adminReconcileAction } from "@/actions/payments";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { requireStaffSession } from "@/lib/auth/dal";
import { formatBrlCents } from "@/lib/commercial/pricing";
import { createClient } from "@/lib/db/supabase/server";
import { checkStripeKeys, getPaymentsStatus, isLivePaymentsEnabled, stripeKeysFromEnv } from "@/lib/payments/config";

export const metadata: Metadata = { title: "Pagamentos (teste)", robots: { index: false, follow: false } };

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const EVENT_TONE: Record<string, "success" | "neutral" | "danger" | "warning"> = { processado: "success", ignorado: "neutral", falhou: "danger", recebido: "warning" };

/**
 * Pagamentos (Fase 9.1, MODO DE TESTE). Equipe lê; só super admin concilia
 * e dispara eventos simulados. Mostra só se as chaves existem e são de
 * teste, nunca o valor. Log de eventos sem dado pessoal nem payload.
 */
export default async function AdminPagamentosPage({ searchParams }: PageProps<"/admin/pagamentos">) {
  const st = getPaymentsStatus();
  if (!st.enabled) notFound();
  const session = await requireStaffSession();
  const isSuper = session.staffRole === "super_admin";
  const supabase = await createClient();
  const [{ data: events }, { data: checkouts }, { data: invoices }, { data: subs }, { data: tenants }] = await Promise.all([
    supabase.from("payment_events").select("*").order("received_at", { ascending: false }).limit(50),
    supabase.from("payment_checkouts").select("id, tenant_id, kind, amount_cents, discount_bp, status, mode, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("payment_invoices").select("provider_invoice_id, tenant_id, status, amount_due_cents, amount_paid_cents, amount_refunded_cents, disputed, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("commercial_subscriptions").select("id, tenant_id, plan_sku, status, mode, provider_subscription_id, current_period_end, cancel_at_period_end").neq("status", "cancelada").order("created_at", { ascending: false }).limit(100),
    supabase.from("tenants").select("id, name"),
  ]);
  const name = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  const keys = stripeKeysFromEnv();
  const keyCheck = checkStripeKeys(keys);
  const failed = (events ?? []).filter((e) => e.status === "falhou").length;
  const sp = await searchParams;
  const simulated = typeof sp.simulado === "string" && /^[a-z_]{3,30}$/.test(sp.simulado) ? sp.simulado : null;
  const outcome = typeof sp.resultado === "string" ? sp.resultado.split(",").filter((r) => ["processado", "ignorado", "repetido", "falhou", "recusado"].includes(r)) : [];

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Pagamentos" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">Pagamentos</h1>
        <Badge tone="danger">AMBIENTE DE TESTE · sem cobrança real</Badge>
      </div>

      {simulated ? (
        <p role="status" className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm font-medium">
          Evento simulado &quot;{simulated}&quot;: {outcome.join(", ") || "sem resultado"}.
        </p>
      ) : null}
      <section aria-labelledby="config" className="border-border rounded-md border p-5 text-sm">
        <h2 id="config" className="text-foreground mb-3 font-semibold">Configuração</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Provedor</dt><dd>{st.provider === "stripe_test" ? "Stripe (modo de teste)" : "Simulado (sem Stripe)"}</dd></div>
          <div><dt className="text-muted-foreground">Cobrança real (live)</dt><dd>{isLivePaymentsEnabled() ? "ligada" : "Desligada (bloqueada no código e no banco)"}</dd></div>
          <div><dt className="text-muted-foreground">Chaves de teste da Stripe</dt><dd>{keyCheck.ok ? "presentes e de teste" : keys.secret || keys.webhook ? keyCheck.problems.join("; ") : "não configuradas"}</dd></div>
          <div><dt className="text-muted-foreground">Eventos com falha (últimos 50)</dt><dd>{failed}</dd></div>
        </dl>
        {isSuper ? (
          <div className="mt-4">
            <AdminActionForm action={adminReconcileAction} submitLabel="Conciliar agora" variant="outline" resetOnSuccess={false} />
            <p className="text-muted-foreground mt-1 text-xs">Lê o provedor e atualiza checkouts, assinaturas e eventos com falha. Nunca cria cobrança.</p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="assinaturas" className="flex flex-col gap-3">
        <h2 id="assinaturas" className="text-foreground text-lg font-semibold">Assinaturas abertas</h2>
        {(subs ?? []).length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma.</p> : (
          <ul className="border-border divide-border divide-y rounded-md border">
            {(subs ?? []).map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 break-words">
                  <strong>{name.get(s.tenant_id) ?? "—"}</strong> · {s.plan_sku} · {s.mode} <Badge tone={s.status === "ativa_teste" || s.status === "ativa_simulada" ? "success" : "warning"}>{s.status.replace("_", " ")}</Badge>
                  {s.current_period_end ? ` · período até ${dt(s.current_period_end)}` : ""}
                  {s.cancel_at_period_end ? " · cancela no fim do período" : ""}
                </span>
                {isSuper && st.provider === "mock" && s.provider_subscription_id ? (
                  <AdminActionForm action={adminMockEventAction.bind(null, s.id)} submitLabel="Simular evento" variant="outline" resetOnSuccess={false}>
                    <Label htmlFor={`ev-${s.id}`} className="sr-only">Evento simulado para {name.get(s.tenant_id)}</Label>
                    <Select id={`ev-${s.id}`} name="evento" defaultValue="renovacao_paga">
                      <option value="renovacao_paga">Renovação paga</option>
                      <option value="renovacao_falhou">Renovação com falha (cartão recusado)</option>
                      <option value="estorno">Estorno da última fatura</option>
                      <option value="contestacao">Contestação da última fatura</option>
                      <option value="cancelar_agora">Cancelamento imediato no provedor</option>
                    </Select>
                  </AdminActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="eventos" className="flex flex-col gap-3">
        <h2 id="eventos" className="text-foreground text-lg font-semibold">Eventos do provedor</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Eventos do provedor de pagamento">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted-foreground text-xs"><tr><th className="py-1 pr-3 font-medium">Recebido</th><th className="py-1 pr-3 font-medium">Tipo</th><th className="py-1 pr-3 font-medium">Empresa</th><th className="py-1 pr-3 font-medium">Situação</th><th className="py-1 font-medium">Tentativas / erro</th></tr></thead>
            <tbody>
              {(events ?? []).map((e) => (
                <tr key={e.provider_event_id} className="border-border border-t align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{dt(e.received_at)}</td>
                  <td className="py-1.5 pr-3"><code>{e.type}</code></td>
                  <td className="py-1.5 pr-3">{e.tenant_id ? name.get(e.tenant_id) ?? "—" : "—"}</td>
                  <td className="py-1.5 pr-3"><Badge tone={EVENT_TONE[e.status] ?? "neutral"}>{e.status}</Badge></td>
                  <td className="py-1.5">{e.attempts}{e.last_error ? ` · ${e.last_error}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="checkouts" className="flex min-w-0 flex-col gap-3">
          <h2 id="checkouts" className="text-foreground text-lg font-semibold">Checkouts</h2>
          <ul className="border-border divide-border divide-y rounded-md border text-sm">
            {(checkouts ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="min-w-0">{name.get(c.tenant_id) ?? "—"} · {c.kind === "subscription" ? "assinatura" : "cadastro de cartão"} · {formatBrlCents(c.amount_cents)}{c.discount_bp ? ` (-${c.discount_bp / 100}%)` : ""}</span>
                <span className="text-muted-foreground">{c.status} · {dt(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="faturas" className="flex min-w-0 flex-col gap-3">
          <h2 id="faturas" className="text-foreground text-lg font-semibold">Faturas</h2>
          <ul className="border-border divide-border divide-y rounded-md border text-sm">
            {(invoices ?? []).map((f) => (
              <li key={f.provider_invoice_id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="min-w-0">{name.get(f.tenant_id) ?? "—"} · {formatBrlCents(f.amount_due_cents)}{f.amount_refunded_cents ? ` · estorno ${formatBrlCents(f.amount_refunded_cents)}` : ""}{f.disputed ? " · contestada" : ""}</span>
                <span className="text-muted-foreground">{f.status} · {dt(f.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Container>
  );
}
