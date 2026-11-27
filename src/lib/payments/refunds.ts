import { createHash } from "node:crypto";

import type { PCharge } from "./types";

/**
 * Reembolso (Fase 10F). Regra pura, sem rede, testável.
 *
 * - Só cobrança PAGA e sem contestação: em contestação, o dinheiro já está
 *   em disputa e o reembolso duplicaria a devolução.
 * - Boleto não tem reembolso pela Stripe (documentação pública: "Boleto
 *   payments don't support refunds"); a devolução é feita fora da Stripe,
 *   por transferência, e registrada à parte.
 * - Cartão e Pix aceitam reembolso pela API. Prazo do Pix e regras de cada
 *   bandeira são da Stripe: se ela recusar, o erro volta para a tela. Nenhum
 *   prazo é presumido aqui.
 * - Método desconhecido: nada automático (vai para tratamento manual).
 * - Valor: inteiro em centavos, > 0 e até o saldo ainda não reembolsado.
 */
export const REFUNDABLE_METHODS = ["card", "pix"] as const;

export type RefundReason = "pedido_do_cliente" | "cobranca_duplicada";

export type RefundDecision =
  | { ok: true; amountCents: number; idempotencyKey: string; stripeReason: "requested_by_customer" | "duplicate" }
  | { ok: false; code: RefundBlockCode };

export type RefundBlockCode =
  | "NAO_PAGA"
  | "CONTESTADA"
  | "BOLETO_SEM_REEMBOLSO"
  | "METODO_DESCONHECIDO"
  | "VALOR_INVALIDO"
  | "VALOR_ACIMA_DO_SALDO";

export const REFUND_BLOCK_MESSAGES: Record<RefundBlockCode, string> = {
  NAO_PAGA: "Só dá para reembolsar uma cobrança paga.",
  CONTESTADA: "A cobrança está em contestação: o valor já está em disputa. Trate pela contestação.",
  BOLETO_SEM_REEMBOLSO: "Boleto não tem reembolso pela Stripe. Devolva por transferência e registre fora daqui.",
  METODO_DESCONHECIDO: "Forma de pagamento sem reembolso automático. Trate manualmente.",
  VALOR_INVALIDO: "Informe um valor maior que zero, em reais.",
  VALOR_ACIMA_DO_SALDO: "O valor é maior que o saldo ainda não reembolsado.",
};

export function remainingRefundableCents(charge: Pick<PCharge, "amountCents" | "amountRefundedCents">): number {
  return Math.max(0, charge.amountCents - charge.amountRefundedCents);
}

/**
 * A chave muda a cada reembolso efetivado (o saldo já reembolsado entra nela),
 * então dois cliques no mesmo estado geram UMA devolução só (a Stripe devolve
 * o mesmo reembolso para a mesma chave), e um segundo reembolso parcial,
 * depois do primeiro, recebe outra chave.
 */
export function refundIdempotencyKey(chargeId: string, alreadyRefundedCents: number, amountCents: number): string {
  const h = createHash("sha256").update(`refund|${chargeId}|${alreadyRefundedCents}|${amountCents}`).digest("hex");
  return `wjb-refund-${h.slice(0, 40)}`;
}

export function evaluateRefund(charge: PCharge, amountCents: number, reason: RefundReason): RefundDecision {
  if (charge.status !== "succeeded") return { ok: false, code: "NAO_PAGA" };
  if (charge.disputed) return { ok: false, code: "CONTESTADA" };
  if (charge.paymentMethodType === "boleto") return { ok: false, code: "BOLETO_SEM_REEMBOLSO" };
  if (!charge.paymentMethodType || !(REFUNDABLE_METHODS as readonly string[]).includes(charge.paymentMethodType)) {
    return { ok: false, code: "METODO_DESCONHECIDO" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, code: "VALOR_INVALIDO" };
  if (amountCents > remainingRefundableCents(charge)) return { ok: false, code: "VALOR_ACIMA_DO_SALDO" };
  return {
    ok: true,
    amountCents,
    idempotencyKey: refundIdempotencyKey(charge.id, charge.amountRefundedCents, amountCents),
    stripeReason: reason === "cobranca_duplicada" ? "duplicate" : "requested_by_customer",
  };
}

/** "123,45" ou "123.45" ou "123" -> centavos; inválido -> NaN. */
export function parseBrlToCents(raw: string): number {
  const v = raw.trim().replace(/^R\$\s*/i, "");
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(v)) return Number.NaN;
  const [inteiro, frac = ""] = v.split(/[.,]/);
  return Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
}
