import {
  buildCancellationRequestXml,
  buildPedRegEventoId,
  CANCELLATION_EVENT,
  CANCELLATION_REASONS,
  EventInputError,
  type CancellationReason,
} from "@/lib/wjb-ai/fiscal/national/events-xml";
import {
  SUBSTITUTION_REASONS,
  type DpsSubstitution,
  type SubstitutionReason,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Cancelamento e substituição de NFS-e: PREPARAÇÃO (Fase 10D). Regras puras.
 *
 * Só usa o que é oficial e verificável:
 * - campos, tabelas de motivo e tamanhos do XSD do release 2;
 * - estado do pedido na plataforma (só nota OFICIAL autorizada pode ser
 *   cancelada ou substituída; nota simulada não tem valor fiscal).
 * Não implementa, por não haver fonte pública lida: prazo legal de
 * cancelamento, regras municipais, quais campos a substituta pode mudar, nem
 * o envio (caminho da API de eventos só no swagger). O portão de transmissão
 * continua fechado: estas funções só montam e validam.
 *
 * Auditoria: `auditEntry` devolve só códigos e o motivo da tabela oficial.
 * A descrição livre do motivo NUNCA vai para a trilha (pode conter nome ou
 * documento de pessoa).
 */
export interface IssuedNote {
  status: FiscalStatus;
  /** Verdadeiro quando não houve emissão oficial (simulação). */
  simulated: boolean;
  /** Chave de acesso da NFS-e oficial, quando existir. */
  accessKey: string | null;
}

export interface PlanIssue {
  code: string;
  message: string;
}

function eligibility(note: IssuedNote, environment: "producao" | "producao_restrita"): PlanIssue[] {
  const out: PlanIssue[] = [];
  if (environment === "producao")
    out.push({ code: "EVENT_PRODUCTION_BLOCKED", message: "Produção fiscal não autorizada nesta fase." });
  if (note.simulated)
    out.push({ code: "EVENT_NOTE_SIMULATED", message: "Nota simulada não tem valor fiscal: não há o que cancelar ou substituir." });
  if (note.status !== "AUTORIZADA" && note.status !== "DOCUMENTOS_DISPONIVEIS")
    out.push({ code: "EVENT_NOTE_NOT_AUTHORIZED", message: "Só uma NFS-e autorizada pode ser cancelada ou substituída." });
  if (!note.accessKey)
    out.push({ code: "EVENT_NO_ACCESS_KEY", message: "A nota não tem chave de acesso oficial." });
  return out;
}

export type CancellationPlan =
  | { ok: true; eventId: string; xml: string }
  | { ok: false; blockers: PlanIssue[] };

export function planCancellation(input: {
  note: IssuedNote;
  environment: "producao" | "producao_restrita";
  author: { kind: "CNPJ" | "CPF"; document: string };
  reason: string;
  description: string;
  at: Date;
}): CancellationPlan {
  const blockers = eligibility(input.note, input.environment);
  if (!(input.reason in CANCELLATION_REASONS))
    blockers.push({ code: "EVENT_REASON_INVALID", message: "Motivo fora da tabela oficial (1, 2 ou 9)." });
  if (blockers.length) return { ok: false, blockers };
  try {
    const xml = buildCancellationRequestXml({
      environment: "producao_restrita",
      accessKey: input.note.accessKey!,
      author: input.author,
      reason: input.reason as CancellationReason,
      description: input.description,
      at: input.at,
    });
    return { ok: true, eventId: buildPedRegEventoId(input.note.accessKey!, CANCELLATION_EVENT), xml };
  } catch (e) {
    if (e instanceof EventInputError)
      return { ok: false, blockers: e.issues.map((m) => ({ code: "EVENT_INPUT_INVALID", message: m })) };
    throw e;
  }
}

export type SubstitutionPlan =
  | { ok: true; substitution: DpsSubstitution }
  | { ok: false; blockers: PlanIssue[] };

export function planSubstitution(input: {
  note: IssuedNote;
  environment: "producao" | "producao_restrita";
  reason: string;
  description?: string;
}): SubstitutionPlan {
  const blockers = eligibility(input.note, input.environment);
  if (!(input.reason in SUBSTITUTION_REASONS))
    blockers.push({ code: "SUBST_REASON_INVALID", message: "Motivo fora da tabela oficial (01 a 05 ou 99)." });
  const d = input.description?.trim();
  if (d !== undefined && d !== "" && (d.length < 15 || d.length > 255))
    blockers.push({ code: "SUBST_DESCRIPTION_LENGTH", message: "A descrição precisa ter de 15 a 255 caracteres." });
  if (blockers.length) return { ok: false, blockers };
  return {
    ok: true,
    substitution: {
      accessKey: input.note.accessKey!,
      reason: input.reason as SubstitutionReason,
      ...(d ? { description: d } : {}),
    },
  };
}

/** Linha da trilha de auditoria: só códigos e o motivo oficial. */
const AUDIT_ACTIONS = {
  cancelamento: { ok: "fiscal.cancellation_prepared", blocked: "fiscal.cancellation_blocked" },
  substituicao: { ok: "fiscal.substitution_prepared", blocked: "fiscal.substitution_blocked" },
} as const;

export function auditEntry(
  kind: keyof typeof AUDIT_ACTIONS,
  plan: CancellationPlan | SubstitutionPlan,
  reason: string,
): { action: string; metadata: Record<string, string | string[]> } {
  return plan.ok
    ? { action: AUDIT_ACTIONS[kind].ok, metadata: { reason } }
    : { action: AUDIT_ACTIONS[kind].blocked, metadata: { reason, codes: plan.blockers.map((b) => b.code) } };
}
