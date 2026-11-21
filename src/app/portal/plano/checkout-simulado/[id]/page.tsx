import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelPendingCheckoutAction, mockPayAction } from "@/actions/payments";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { requireSession } from "@/lib/auth/dal";
import { formatBrlCents } from "@/lib/commercial/pricing";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { getPaymentsStatus } from "@/lib/payments/config";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Pagamento simulado", robots: { index: false, follow: false } };

/**
 * Checkout SIMULADO (Fase 9.1): substitui a página da Stripe enquanto não há
 * conta de teste. Só a empresa dona da sessão abre; só com provedor `mock`.
 * Os botões geram os mesmos eventos que a Stripe mandaria ao webhook.
 */
export default async function CheckoutSimuladoPage({ params }: PageProps<"/portal/plano/checkout-simulado/[id]">) {
  const st = getPaymentsStatus();
  if (!st.enabled || st.provider !== "mock") notFound();
  const session = await requireSession();
  if (session.isWjbStaff) notFound();
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) notFound();
  const { id } = await params;
  const db = createAdminClient();
  const { data: c } = await db.from("payment_checkouts").select("id, kind, amount_cents, discount_bp, status, plan_id").eq("provider_session_id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!c) notFound();
  const { data: plan } = await db.from("commercial_plans").select("name").eq("id", c.plan_id).maybeSingle();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <div role="note" className="border-danger/40 bg-danger/5 max-w-xl rounded-md border px-4 py-3 text-sm">
        <strong>PAGAMENTO SIMULADO / AMBIENTE DE TESTE.</strong> Esta página imita o checkout da Stripe. Nenhum dado de cartão é pedido e
        nenhum dinheiro é cobrado.
      </div>
      <section aria-labelledby="resumo" className="border-border flex max-w-xl flex-col gap-3 rounded-md border p-5">
        <h1 id="resumo" className="text-foreground text-xl font-semibold">{plan?.name ?? "Plano de emissão"}</h1>
        {c.kind === "subscription" ? (
          <p className="text-sm">
            Assinatura mensal: <strong className="tabular-nums">{formatBrlCents(c.amount_cents)}</strong>
            {c.discount_bp ? ` (com ${c.discount_bp / 100}% de desconto de cliente de contabilidade)` : ""}.
          </p>
        ) : (
          <p className="text-sm">Cadastro de forma de pagamento. Nada é cobrado agora: só nota oficialmente autorizada será cobrada.</p>
        )}
        {c.status !== "aberto" ? (
          <p role="status" className="text-sm">Este pagamento não está mais aberto.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <AdminActionForm action={mockPayAction.bind(null, id, "aprovado")} submitLabel={c.kind === "subscription" ? "Pagar (teste)" : "Cadastrar cartão (teste)"} variant="cta" resetOnSuccess={false} />
            <AdminActionForm action={mockPayAction.bind(null, id, "recusado")} submitLabel="Simular cartão recusado" variant="outline" resetOnSuccess={false} />
            <AdminActionForm action={cancelPendingCheckoutAction} submitLabel="Desistir" variant="outline" resetOnSuccess={false} />
          </div>
        )}
        <Link href="/portal/plano" className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>Voltar ao plano</Link>
      </section>
    </Container>
  );
}
