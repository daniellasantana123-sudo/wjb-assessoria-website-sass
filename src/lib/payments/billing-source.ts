/**
 * Fase 10F: uma ÚNICA origem de cobrança ativa por empresa e serviço.
 *
 * Responsabilidades (doc 07 da Fase 10F):
 * - Stripe: processa o pagamento do que é contratado pela plataforma.
 * - Plataforma WJB: contratação, situação do serviço e acesso.
 * - Omie: gestão financeira da WJB (hoje a plataforma NÃO cria nada
 *   financeiro no Omie: a integração existente é só com o G-Click).
 * - G-Click: tarefas e obrigações (sem dinheiro).
 *
 * A regra fica no banco (índice único parcial da 0038) e aqui, para a tela
 * explicar o motivo antes de tentar gravar.
 */
export const BILLING_SERVICE_KEYS = ["nfse_plano", "honorarios_contabeis"] as const;
export type BillingSource = "stripe" | "omie" | "externo";

export interface BillingAssignment {
  service_key: string;
  source: BillingSource;
  status: "ativa" | "encerrada";
}

export const BILLING_SOURCE_LABELS: Record<BillingSource, string> = {
  stripe: "Stripe (pela plataforma)",
  omie: "Omie",
  externo: "Outro meio (boleto do banco, transferência...)",
};

export function isValidServiceKey(key: string): boolean {
  return (BILLING_SERVICE_KEYS as readonly string[]).includes(key) || /^servico_avulso:[a-z0-9_]{2,60}$/.test(key);
}

export type BillingCheck = { ok: true; alreadyStripe: boolean } | { ok: false; activeSource: BillingSource };

/** Pode cobrar este serviço pela Stripe? Só se não houver outra origem ativa. */
export function canChargeWithStripe(assignments: BillingAssignment[], serviceKey: string): BillingCheck {
  const active = assignments.find((a) => a.status === "ativa" && a.service_key === serviceKey);
  if (!active) return { ok: true, alreadyStripe: false };
  if (active.source === "stripe") return { ok: true, alreadyStripe: true };
  return { ok: false, activeSource: active.source };
}

export function blockedMessage(source: BillingSource): string {
  return `Este serviço já é cobrado por ${BILLING_SOURCE_LABELS[source]}. Para cobrar pela plataforma, a equipe da WJB precisa encerrar a cobrança atual antes (evita cobrança em dobro).`;
}
