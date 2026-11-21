import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";

/**
 * Fila de revisão do contador (Fase 7): prioridade, prazo e diferença entre
 * versões de um pedido corrigido. Funções puras.
 */
export const PRIORITIES = {
  urgente: { label: "Urgente", hours: 4 },
  alta: { label: "Alta", hours: 8 },
  normal: { label: "Normal", hours: 24 },
  baixa: { label: "Baixa", hours: 72 },
} as const;
export type Priority = keyof typeof PRIORITIES;
export const isPriority = (v: string): v is Priority => v in PRIORITIES;

export type SlaState = "sem_prazo" | "no_prazo" | "vence_logo" | "vencido";

/** "vence logo" = menos de 25% do prazo da prioridade restante. */
export function slaState(
  dueAt: string | null,
  priority: Priority,
  now: Date,
): SlaState {
  if (!dueAt) return "sem_prazo";
  const left = Date.parse(dueAt) - now.getTime();
  if (left < 0) return "vencido";
  return left < PRIORITIES[priority].hours * 3_600_000 * 0.25
    ? "vence_logo"
    : "no_prazo";
}

export function sortForReview<
  T extends { priority: string; reviewDueAt: string | null; createdAt: string },
>(rows: T[]): T[] {
  const rank = (p: string) =>
    isPriority(p) ? Object.keys(PRIORITIES).indexOf(p) : 9;
  return [...rows].sort(
    (a, b) =>
      (a.reviewDueAt ?? "9999").localeCompare(b.reviewDueAt ?? "9999") ||
      rank(a.priority) - rank(b.priority) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export interface DraftChange {
  field: string;
  before: string;
  after: string;
}

const FIELDS: [string, (d: NormalizedNfseDraft) => string][] = [
  ["Serviço", (d) => d.serviceDescription],
  ["Valor", (d) => formatCents(d.amountCents)],
  ["Competência", (d) => d.competence],
  ["Tomador", (d) => d.taker.name],
  // Documento sempre mascarado na comparação: o contador vê que mudou, não o número inteiro.
  [
    "Documento do tomador",
    (d) => `${d.taker.documentKind} ${maskDocument(d.taker.document)}`,
  ],
  ["E-mail do tomador", (d) => (d.taker.email ? "informado" : "não informado")],
];

/** Campos que mudaram entre duas versões do rascunho. */
export function diffDrafts(
  before: NormalizedNfseDraft,
  after: NormalizedNfseDraft,
): DraftChange[] {
  const out: DraftChange[] = [];
  for (const [field, get] of FIELDS) {
    const b = get(before);
    const a = get(after);
    if (
      field === "Documento do tomador" &&
      before.taker.document !== after.taker.document &&
      a === b
    )
      out.push({ field, before: b, after: `${a} (alterado)` });
    else if (b !== a) out.push({ field, before: b, after: a });
  }
  if (
    before.taker.email &&
    after.taker.email &&
    before.taker.email !== after.taker.email
  )
    out.push({
      field: "E-mail do tomador",
      before: "informado",
      after: "alterado",
    });
  return out;
}
