import type { PCheckoutSession, PInvoice } from "./types";

/**
 * Regras puras de tradução do provedor para a WJB (Fase 9.1). Sem banco,
 * testáveis. Toda decisão de dar acesso parte do estado ATUAL buscado no
 * provedor, nunca do conteúdo do evento nem da página de retorno.
 */
export type LocalSubStatus = "pendente_pagamento" | "ativa_teste" | "inadimplente" | "suspensa" | "cancelada";

export function mapSubscriptionStatus(stripeStatus: string): LocalSubStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "ativa_teste";
    case "past_due":
    case "unpaid":
      return "inadimplente";
    case "paused":
      return "suspensa";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    default:
      return "pendente_pagamento"; // incomplete e qualquer status desconhecido: sem acesso
  }
}

export function mapInvoiceStatus(s: PInvoice["status"]): "rascunho" | "aberta" | "paga" | "incobravel" | "anulada" {
  return ({ draft: "rascunho", open: "aberta", paid: "paga", uncollectible: "incobravel", void: "anulada" } as const)[s];
}

/** O checkout terminou com pagamento confirmado (ou sem pagamento devido, como no cadastro de cartão)? */
export function sessionIsPaid(s: PCheckoutSession): boolean {
  return s.status === "complete" && (s.paymentStatus === "paid" || s.paymentStatus === "no_payment_required");
}

/**
 * Transição permitida de status local a partir de um status vindo do
 * provedor. Cancelada é final (evento antigo fora de ordem não ressuscita).
 */
export function nextStatus(current: string, incoming: LocalSubStatus): string {
  if (current === "cancelada") return "cancelada";
  return incoming;
}

/**
 * Cobranças por nota a partir de eventos FISCAIS OFICIAIS faturáveis (nunca
 * simulados). Avulsa: cada nota oficial. Planos com franquia: só o que passou
 * da franquia, e só com excedente autorizado. Nesta fase não há nota oficial,
 * então o resultado é sempre vazio na prática; a regra fica pronta e testada.
 */
export function planUsageCharges(input: {
  quota: number | null;
  overageCents: number | null;
  monthlyCents: number | null;
  overageAuthorized: boolean;
  officialBillableInCycle: number;
  alreadyChargedInCycle: number;
}): { notes: number; amountCents: number } {
  const { quota, overageCents, monthlyCents, overageAuthorized, officialBillableInCycle, alreadyChargedInCycle } = input;
  if (overageCents === null || monthlyCents === null) return { notes: 0, amountCents: 0 }; // contratual
  const perNote = quota === null || quota === 0;
  const chargeable = perNote ? officialBillableInCycle : overageAuthorized ? Math.max(0, officialBillableInCycle - (quota ?? 0)) : 0;
  const notes = Math.max(0, chargeable - alreadyChargedInCycle);
  return { notes, amountCents: notes * overageCents };
}

/** Chave estável do preço no provedor: muda com a versão aprovada e com o desconto. */
export function priceLookupKey(sku: string, version: number, discountBp: number): string {
  return `wjb_${sku}_v${version}_d${discountBp}`;
}
