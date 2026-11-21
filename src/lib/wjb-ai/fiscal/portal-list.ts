import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Lista de solicitações do cliente (Fase 7): grupos de status em linguagem do
 * cliente, busca, paginação. Funções puras, testáveis sem banco.
 */
export const STATUS_GROUPS = {
  todas: { label: "Todas", statuses: null },
  andamento: {
    label: "Em andamento",
    statuses: [
      "RECEBIDA",
      "TRIAGEM",
      "VALIDACAO_FISCAL",
      "PRONTA_PARA_CONFIRMACAO",
      "CONFIRMADA",
    ],
  },
  acao: { label: "Precisa de você", statuses: ["DADOS_PENDENTES"] },
  revisao: {
    label: "Com o contador",
    statuses: ["REVISAO_HUMANA", "BLOQUEADA"],
  },
  fila: {
    label: "Na fila (simulação)",
    statuses: [
      "AUTORIZADA_PARA_ENVIO",
      "ENFILEIRADA",
      "ENVIANDO",
      "RESULTADO_INDETERMINADO",
      "CONCILIACAO_OFICIAL",
    ],
  },
  concluidas: {
    label: "Resultado da simulação",
    statuses: [
      "AUTORIZADA",
      "REJEITADA",
      "DOCUMENTOS_DISPONIVEIS",
      "NOTIFICADA",
    ],
  },
} as const satisfies Record<
  string,
  { label: string; statuses: readonly FiscalStatus[] | null }
>;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export const PAGE_SIZE = 20;

export interface ListItem {
  id: string;
  status: FiscalStatus;
  createdAt: string;
  draft: NormalizedNfseDraft;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function parseListParams(
  sp: Record<string, string | string[] | undefined>,
) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const g = one("status");
  const group: StatusGroup = g in STATUS_GROUPS ? (g as StatusGroup) : "todas";
  const page = Math.max(
    1,
    Math.min(1000, Number.parseInt(one("pagina"), 10) || 1),
  );
  const q = one("q").trim().slice(0, 80);
  return { group, page, q };
}

/** Busca por serviço, tomador ou competência (sem acento/maiúscula; todas as palavras). */
export function filterList<T extends ListItem>(
  items: T[],
  group: StatusGroup,
  q: string,
): T[] {
  const statuses = STATUS_GROUPS[group].statuses as
    readonly FiscalStatus[] | null;
  const words = fold(q).split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (statuses && !statuses.includes(i.status)) return false;
    if (!words.length) return true;
    const hay = fold(
      `${i.draft.serviceDescription} ${i.draft.taker.name} ${i.draft.competence}`,
    );
    return words.every((w) => hay.includes(w));
  });
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: items.length,
  };
}
