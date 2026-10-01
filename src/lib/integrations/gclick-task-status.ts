/**
 * Status de tarefa do G-Click em português (2026-10-01), conforme a tabela
 * da documentação oficial: A=Aberto/Autorizada, S=Aguardando/Solicitado,
 * E=Retificando, P=Solicitado externo, C=Concluído, F=Finalizado,
 * O=Retificado, X=Cancelado, D=Dispensado. Código desconhecido aparece como
 * veio, em tom neutro, em vez de ser forçado num status.
 */
export type TaskTone = "info" | "warning" | "success" | "neutral" | "danger";

const STATUS: Record<string, { label: string; tone: TaskTone; open: boolean }> = {
  A: { label: "Aberta", tone: "info", open: true },
  S: { label: "Aguardando", tone: "warning", open: true },
  E: { label: "Retificando", tone: "warning", open: true },
  P: { label: "Solicitada externamente", tone: "warning", open: true },
  C: { label: "Concluída", tone: "success", open: false },
  F: { label: "Finalizada", tone: "success", open: false },
  O: { label: "Retificada", tone: "success", open: false },
  X: { label: "Cancelada", tone: "neutral", open: false },
  D: { label: "Dispensada", tone: "neutral", open: false },
  // Status do modo simulado (mock), para a tela funcionar igual em desenvolvimento.
  OPEN: { label: "Aberta", tone: "info", open: true },
  COMPLETED: { label: "Concluída", tone: "success", open: false },
};

export function gclickTaskStatus(code: string): { label: string; tone: TaskTone; open: boolean } {
  const known = STATUS[code.trim().toUpperCase()];
  return known ?? { label: code || "Sem status", tone: "neutral", open: true };
}

/** "2026-09-30" -> "30/09/2026"; "2026-09" ou "2026-09-01" na competência -> "09/2026". */
export function formatGClickDate(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export function formatCompetence(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[2]}/${match[1]}` : null;
}
