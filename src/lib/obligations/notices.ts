/**
 * Texto e link dos avisos de obrigação enviados ao cliente (2026-09-30).
 * Função pura, sem banco: quem dispara é `notifyObligationEvent`
 * (`src/lib/notifications.ts`).
 *
 * Vários itens do mesmo evento viram UM aviso com a lista - uma
 * sincronização com o G-Click pode concluir várias obrigações de uma vez, e
 * um e-mail por obrigação encheria a caixa do cliente.
 */
export type ObligationNoticeKind = "created" | "completed" | "due_soon" | "due_today";

export interface ObligationRef {
  id: string;
  title: string;
  dueDate: string; // yyyy-MM-dd
}

const MAX_TITLES = 3;

export function formatDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function listTitles(obligations: ObligationRef[]): string {
  const shown = obligations.slice(0, MAX_TITLES).map((o) => `"${o.title}"`);
  const rest = obligations.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} e mais ${rest}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} e ${shown[shown.length - 1]}`;
}

export function buildObligationNotice(
  kind: ObligationNoticeKind,
  obligations: ObligationRef[],
): { body: string; link: string } {
  const single = obligations.length === 1 ? obligations[0] : null;
  const link = single ? `/portal/obrigacoes/${single.id}` : "/portal/obrigacoes";
  const n = obligations.length;

  switch (kind) {
    case "created":
      return {
        body: single
          ? `Nova obrigação: "${single.title}", com vencimento em ${formatDueDate(single.dueDate)}.`
          : `${n} novas obrigações: ${listTitles(obligations)}.`,
        link,
      };
    case "completed":
      return {
        body: single
          ? `A WJB concluiu a obrigação "${single.title}".`
          : `A WJB concluiu ${n} obrigações: ${listTitles(obligations)}.`,
        link,
      };
    case "due_soon":
      return {
        body: single
          ? `"${single.title}" vence em 3 dias (${formatDueDate(single.dueDate)}).`
          : `${n} obrigações vencem em 3 dias: ${listTitles(obligations)}.`,
        link,
      };
    case "due_today":
      return {
        body: single
          ? `"${single.title}" vence hoje.`
          : `${n} obrigações vencem hoje: ${listTitles(obligations)}.`,
        link,
      };
  }
}
