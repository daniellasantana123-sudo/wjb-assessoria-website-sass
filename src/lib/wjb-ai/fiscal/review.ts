import type { TransitionStep } from "@/lib/wjb-ai/fiscal/requests";
import { assertTransition, type FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Decisões do contador sobre um pedido em revisão (F3). Regras puras; a
 * gravação fica em `admin.repo.ts`.
 */
export type ReviewDecision = "approve" | "request_data" | "block";

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  approve: "Aprovar para envio",
  request_data: "Pedir correção ao cliente",
  block: "Bloquear",
};

export type ReviewPlan = { ok: true; steps: TransitionStep[] } | { ok: false; error: string };

export function planReview(current: FiscalStatus, decision: ReviewDecision, note: string): ReviewPlan {
  if (current !== "REVISAO_HUMANA") return { ok: false, error: "Só um pedido em revisão pode receber esta decisão." };
  const text = note.trim();
  if (decision !== "approve" && text.length < 10) {
    return { ok: false, error: "Explique o motivo (mínimo de 10 caracteres); o cliente vai ver este texto." };
  }
  let steps: TransitionStep[];
  if (decision === "approve") {
    steps = [
      { from: "REVISAO_HUMANA", to: "PRONTA_PARA_CONFIRMACAO", reason: text ? `Revisado pelo contador: ${text}` : "Revisado pelo contador." },
      // O cliente já conferiu e confirmou esta mesma prévia; o snapshot não muda na revisão.
      { from: "PRONTA_PARA_CONFIRMACAO", to: "CONFIRMADA", reason: "Confirmação do cliente mantida (dados não alterados na revisão)." },
    ];
  } else if (decision === "request_data") {
    steps = [{ from: "REVISAO_HUMANA", to: "DADOS_PENDENTES", reason: `Correção pedida: ${text}` }];
  } else {
    steps = [{ from: "REVISAO_HUMANA", to: "BLOQUEADA", reason: `Bloqueado pelo contador: ${text}` }];
  }
  for (const s of steps) assertTransition(s.from, s.to);
  return { ok: true, steps };
}

export interface SendReadiness {
  status: FiscalStatus;
  hasApprovedProfile: boolean;
  grantValidUntil: string | null;
  providerMode: "mock" | "homologacao" | "producao";
  today: string;
}

/** Quando o pedido pode ir para a fila de envio (sempre simulado nesta fase). */
export function checkSendReadiness(r: SendReadiness): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (r.status !== "CONFIRMADA") reasons.push("O pedido precisa estar confirmado.");
  if (!r.hasApprovedProfile) reasons.push("A empresa não tem perfil fiscal aprovado.");
  if (!r.grantValidUntil) reasons.push("A empresa não tem autorização de emissão registrada.");
  else if (r.grantValidUntil < r.today) reasons.push("A autorização de emissão está vencida.");
  if (r.providerMode !== "mock") reasons.push("Nesta fase só o conector simulado pode ser usado.");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
