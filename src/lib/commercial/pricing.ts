/**
 * Motor comercial (Fase 8). Regras puras, sem banco; o servidor é a única
 * fonte de verdade do preço final (o navegador nunca envia valor).
 *
 * Valores (mensalidade, franquia, nota extra, desconto do combo) vêm SEMPRE do
 * catálogo no banco, versionado e aprovado no Admin; nada de preço aqui.
 *
 * Princípios aprovados (Fase 8; preços aprovados em 21/11/2026):
 * - desconto do combo SÓ sobre a mensalidade do plano de emissão (nunca sobre
 *   honorários, nota avulsa ou excedente), sem acumular;
 * - franquia por empresa e por ciclo;
 * - excedente nunca é cobrado sem autorização prévia e dentro do limite de gasto;
 * - consumo SIMULADO nunca é faturável: só um evento oficial idempotente seria.
 */
export interface PlanSnapshot {
  sku: string;
  monthlyCents: number | null; // null = sob proposta
  quota: number | null; // 0 ou null = sem franquia (avulso, cobra por nota)
  overageCents: number | null;
}

/**
 * Plano cobrado por nota (Nota Avulsa: franquia 0 aprovada em 21/11/2026; o
 * valor nulo é aceito pelo mesmo motivo). Não há "excedente": cada nota
 * oficial autorizada é o próprio modelo contratado.
 */
export function isPerNotePlan(plan: Pick<PlanSnapshot, "quota" | "overageCents" | "monthlyCents">): boolean {
  return (plan.quota === null || plan.quota === 0) && plan.overageCents !== null && plan.monthlyCents !== null;
}

export interface SubscriptionSnapshot extends PlanSnapshot {
  discountBp: number;
  status: "ativa_simulada" | "suspensa" | "cancelada";
  overageAuthorized: boolean;
  spendingLimitCents: number | null;
}

export const MAX_COMBO_DISCOUNT_BP = 5000; // trava: nunca mais de 50%, mesmo configurado errado

export function comboDiscountBp(isAccountingClient: boolean, configuredBp: number): number {
  if (!isAccountingClient) return 0;
  return Math.max(0, Math.min(MAX_COMBO_DISCOUNT_BP, Math.round(configuredBp)));
}

/** Mensalidade com desconto (centavos). Desconto nunca incide em plano sem mensalidade. */
export function monthlyWithDiscount(plan: PlanSnapshot, discountBp: number): number | null {
  if (plan.monthlyCents === null) return null;
  const discount = Math.floor((plan.monthlyCents * discountBp) / 10_000);
  return plan.monthlyCents - discount;
}

export type QuotaAlert = "nenhum" | "80" | "100" | "excedente";

export interface UsageSummary {
  used: number;
  quota: number | null;
  percent: number | null;
  alert: QuotaAlert;
  overageCount: number;
}

export function usageSummary(quota: number | null, used: number): UsageSummary {
  // Sem franquia (avulso): não há percentual nem excedente, cada nota é cobrada como contratado.
  if (quota === null || quota === 0) return { used, quota, percent: null, alert: "nenhum", overageCount: 0 };
  const percent = Math.round((used / quota) * 100);
  const overageCount = Math.max(0, used - quota);
  const alert: QuotaAlert = used > quota ? "excedente" : used >= quota ? "100" : percent >= 80 ? "80" : "nenhum";
  return { used, quota, percent, alert, overageCount };
}

export type ConsumeDecision =
  | { allowed: true; overage: boolean; overageCostCents: number }
  | { allowed: false; reason: "sem_assinatura_ativa" | "excedente_nao_autorizado" | "limite_de_gasto" | "sob_proposta" };

/**
 * Pode registrar mais uma nota neste ciclo? Avalia ANTES de confirmar o pedido,
 * para o cliente ver o custo do excedente antes de decidir.
 */
export function canConsume(sub: SubscriptionSnapshot | null, usedThisCycle: number): ConsumeDecision {
  if (!sub || sub.status !== "ativa_simulada") return { allowed: false, reason: "sem_assinatura_ativa" };
  if (sub.overageCents === null || sub.monthlyCents === null) {
    // Alto Volume: condições contratuais, nunca calculadas aqui.
    if (sub.quota !== null && sub.quota > 0 && usedThisCycle < sub.quota) return { allowed: true, overage: false, overageCostCents: 0 };
    return { allowed: false, reason: "sob_proposta" };
  }
  const isAvulso = isPerNotePlan(sub);
  if (!isAvulso && usedThisCycle < (sub.quota ?? 0)) return { allowed: true, overage: false, overageCostCents: 0 };
  // Plano avulso (sem franquia) cobra por nota: é o modelo contratado, não excedente.
  if (!isAvulso && !sub.overageAuthorized) return { allowed: false, reason: "excedente_nao_autorizado" };
  const already = isAvulso ? usedThisCycle : usedThisCycle - (sub.quota ?? 0);
  const nextTotal = (already + 1) * sub.overageCents;
  if (sub.spendingLimitCents !== null && nextTotal > sub.spendingLimitCents) return { allowed: false, reason: "limite_de_gasto" };
  return { allowed: true, overage: !isAvulso, overageCostCents: sub.overageCents };
}

export interface InvoiceLine {
  label: string;
  cents: number;
}
export interface InvoicePreview {
  simulated: true;
  lines: InvoiceLine[];
  totalCents: number;
  note: string;
}

/**
 * Prévia da fatura do ciclo. `billableEvents` conta só eventos OFICIAIS
 * faturáveis; nesta fase é sempre 0, então excedente nunca aparece cobrado
 * por consumo simulado (ele é mostrado à parte, como informação).
 */
export function invoicePreview(sub: SubscriptionSnapshot, billableEvents: number, simulatedEvents: number, planName?: string | null): InvoicePreview {
  const lines: InvoiceLine[] = [];
  if (sub.monthlyCents !== null) {
    lines.push({ label: `Mensalidade ${planName ?? sub.sku}`, cents: sub.monthlyCents });
    const discount = sub.monthlyCents - (monthlyWithDiscount(sub, sub.discountBp) ?? sub.monthlyCents);
    if (discount > 0) lines.push({ label: "Desconto cliente de contabilidade (só mensalidade)", cents: -discount });
  }
  if (sub.overageCents !== null) {
    const base = sub.quota ?? 0;
    const billableOverage = Math.max(0, billableEvents - base);
    const label = isPerNotePlan(sub) ? `Notas avulsas: ${billableOverage} nota(s) oficial(is)` : `Excedente: ${billableOverage} nota(s) oficial(is)`;
    if (billableOverage > 0) lines.push({ label, cents: billableOverage * sub.overageCents });
  }
  const totalCents = lines.reduce((s, l) => s + l.cents, 0);
  return {
    simulated: true,
    lines,
    totalCents,
    note: `SIMULAÇÃO: nenhuma cobrança é feita. ${simulatedEvents} nota(s) simulada(s) neste ciclo não geram cobrança.`,
  };
}

/** Ciclo mensal [início, fim) a partir do dia de hoje (datas locais AAAA-MM-DD). */
export function cycleFor(today: string): { start: string; end: string } {
  const [y, m] = today.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { start, end: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

export function formatBrlCents(cents: number | null): string {
  if (cents === null) return "Sob proposta";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Versões dos documentos aceitos na contratação simulada. Preços aprovados em
 * 21/11/2026; os textos de termos, privacidade e representação continuam
 * minuta, à espera de revisão jurídica.
 */
export const ACCEPTANCE_DOCUMENTS = {
  termos_emissao: { label: "Termos do serviço de emissão (minuta, simulação)", version: "2026-11-21-rascunho" },
  privacidade: { label: "Política de privacidade", version: "2026-09-rascunho" },
  precos_franquia: { label: "Preço, franquia e excedente do plano (valores aprovados pela WJB em 21/11/2026)", version: "2026-11-21-aprovado" },
  representacao_fiscal: { label: "Autorização para a WJB atuar na emissão (procuração eletrônica, quando houver)", version: "2026-11-21-rascunho" },
} as const;
export type AcceptanceDocument = keyof typeof ACCEPTANCE_DOCUMENTS;

/**
 * Margem por plano a partir de premissas de custo DEFINIDAS PELA WJB
 * (custo variável por nota e custo fixo por cliente/mês). Sem premissa, a
 * análise diz que falta a premissa: nenhum custo de fornecedor é inventado.
 */
export interface CostPremises {
  costPerNoteCents: number | null;
  fixedCostPerClientCents: number | null;
}
export function marginAt(plan: PlanSnapshot, notes: number, discountBp: number, p: CostPremises) {
  if (p.costPerNoteCents === null || p.fixedCostPerClientCents === null) return { defined: false as const };
  const monthly = monthlyWithDiscount(plan, discountBp) ?? 0;
  const extra = isPerNotePlan(plan) ? notes : Math.max(0, notes - (plan.quota ?? 0));
  const revenue = monthly + extra * (plan.overageCents ?? 0);
  const cost = p.fixedCostPerClientCents + notes * p.costPerNoteCents;
  return { defined: true as const, revenueCents: revenue, costCents: cost, marginCents: revenue - cost, marginPct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null };
}
