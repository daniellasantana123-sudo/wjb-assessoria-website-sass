import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";

/**
 * Policy Engine determinístico (seção 5.1). Decide se o rascunho fica
 * BLOQUEADO, vai para REVISÃO HUMANA ou está PRONTO PARA CONFIRMAÇÃO do
 * cliente. Nunca decide tributação e nunca autoaprova: `AUTO_APPROVED` não
 * existe neste incremento (autoemissão é a fase F7, com regras do contador).
 */
export type PolicyDecision =
  "BLOCKED" | "HUMAN_REVIEW" | "READY_FOR_CONFIRMATION";

export type PolicyReason =
  | "modulo_desligado"
  | "perfil_fiscal_nao_aprovado"
  | "sem_autorizacao_de_emissao"
  | "autorizacao_vencida"
  | "valor_acima_do_limite"
  | "possivel_nota_de_mercadoria"
  | "possivel_duplicidade";

export interface ApprovedFiscalProfile {
  approved: true;
  /** Limite por nota para seguir sem revisão; definido pelo contador. */
  maxAmountCentsWithoutReview: number;
}

export interface AuthorizationGrant {
  status: "active" | "revoked";
  validUntil: string; // ISO date
}

export interface PolicyInput {
  moduleEnabled: boolean;
  draft: NormalizedNfseDraft;
  fiscalProfile: ApprovedFiscalProfile | null;
  authorizationGrant: AuthorizationGrant | null;
  duplicateSuspected: boolean;
  today: string; // AAAA-MM-DD
}

export interface PolicyResult {
  decision: PolicyDecision;
  reasons: PolicyReason[];
}

const PRODUCT_HINT =
  /\b(mercadoria|mercadorias|venda de produto|produtos vendidos|revenda|nf-?e modelo 55|nfc-?e)\b/i;

export const POLICY_REASON_LABELS: Record<PolicyReason, string> = {
  modulo_desligado: "O módulo WJB AI está desligado.",
  perfil_fiscal_nao_aprovado:
    "A empresa ainda não tem perfil fiscal aprovado pelo contador.",
  sem_autorizacao_de_emissao:
    "Não há autorização de emissão registrada para esta empresa.",
  autorizacao_vencida: "A autorização de emissão está vencida ou revogada.",
  valor_acima_do_limite:
    "O valor está acima do limite definido para seguir sem revisão.",
  possivel_nota_de_mercadoria:
    "A descrição sugere venda de mercadoria, que não é NFS-e.",
  possivel_duplicidade: "Já existe um pedido igual; um contador vai conferir.",
};

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  if (!input.moduleEnabled)
    return { decision: "BLOCKED", reasons: ["modulo_desligado"] };

  const reasons: PolicyReason[] = [];
  if (PRODUCT_HINT.test(input.draft.serviceDescription))
    reasons.push("possivel_nota_de_mercadoria");
  if (!input.fiscalProfile) reasons.push("perfil_fiscal_nao_aprovado");
  if (!input.authorizationGrant) {
    reasons.push("sem_autorizacao_de_emissao");
  } else if (
    input.authorizationGrant.status !== "active" ||
    input.authorizationGrant.validUntil < input.today
  ) {
    reasons.push("autorizacao_vencida");
  }
  if (
    input.fiscalProfile &&
    input.draft.amountCents > input.fiscalProfile.maxAmountCentsWithoutReview
  ) {
    reasons.push("valor_acima_do_limite");
  }
  if (input.duplicateSuspected) reasons.push("possivel_duplicidade");

  return {
    decision: reasons.length ? "HUMAN_REVIEW" : "READY_FOR_CONFIRMATION",
    reasons,
  };
}
