import type { ExternalTask } from "@/integrations/omie-gclick";

/**
 * Tradução de tarefa do Omie.G-Click para obrigação da plataforma
 * (2026-09-24).
 *
 * Fica separada da Server Action de propósito: é a parte com regra de
 * negócio de verdade (que status vira o quê, o que não deve ser
 * importado) e é testável sem banco nem rede.
 */

export const EXTERNAL_SOURCE = "omie_gclick" as const;

/**
 * O que fazer com uma tarefa, olhando só o status dela.
 *
 * - `pending` / `done`: vira obrigação com esse status.
 * - `drop`: não é obrigação nenhuma para o cliente - se já tiver sido
 *   importada antes, deve ser removida, não deixada pendente para sempre.
 */
export type TaskDisposition = "pending" | "done" | "drop";

/**
 * Status do G-Click, conforme a documentação oficial (coleção Postman,
 * confirmada em 2026-09-23): A=Aberto, S=Aguardando/Solicitado,
 * X=Cancelado, C=Concluído, D=Dispensado, F=Finalizado, E=Retificando,
 * O=Retificado, P=Solicitado externo.
 *
 * Cancelado e Dispensado viram `drop`: não são "concluídas" (ninguém
 * fez nada) nem "pendentes" (não há o que fazer). Mostrá-las ao cliente
 * como pendência seria um alarme falso permanente.
 *
 * Retificando (E) conta como pendente: há trabalho em curso. Retificado
 * (O) como concluído: o trabalho terminou.
 */
const STATUS_MAP: Record<string, TaskDisposition> = {
  a: "pending",
  s: "pending",
  e: "pending",
  p: "pending",
  c: "done",
  f: "done",
  o: "done",
  x: "drop",
  d: "drop",
  // Status do provider mock, para o fluxo poder ser exercitado em
  // desenvolvimento sem tocar a API real.
  open: "pending",
  completed: "done",
  cancelled: "drop",
};

/**
 * Status desconhecido cai em `pending` de propósito: é o erro menos
 * grave. Marcar como concluída esconderia uma obrigação real do cliente;
 * marcar como pendente, no pior caso, mostra algo que ele já cumpriu - e
 * isso ele percebe e questiona.
 */
export function mapTaskStatus(raw: string): TaskDisposition {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? "pending";
}

export interface ObligationFromTask {
  externalId: string;
  title: string;
  dueDate: string;
  status: "pending" | "done";
}

export interface TaskPlan {
  /** Tarefas que devem existir como obrigação (criar ou atualizar). */
  upserts: ObligationFromTask[];
  /** Ids externos que não devem mais existir como obrigação. */
  removals: string[];
  /** Quantas tarefas foram ignoradas por não terem dado suficiente. */
  skipped: number;
}

/**
 * Monta o plano de sincronização de um tenant a partir das tarefas
 * recebidas.
 *
 * Duas exclusões deliberadas:
 * - Tarefa de outro cliente: a API devolve as tarefas da conta inteira,
 *   então filtrar pelo `clientExternalId` aqui é o que impede uma empresa
 *   de enxergar a obrigação de outra. É a barreira mais importante deste
 *   arquivo.
 * - Tarefa sem vencimento: `obligations.due_date` é obrigatório e não há
 *   data plausível para inventar. Entra na contagem de ignoradas, que a
 *   interface mostra, em vez de sumir em silêncio.
 */
export function planObligationSync(
  tasks: ExternalTask[],
  clientExternalId: string,
): TaskPlan {
  const upserts: ObligationFromTask[] = [];
  const removals: string[] = [];
  let skipped = 0;

  for (const task of tasks) {
    if (task.clientExternalId !== clientExternalId) continue;
    if (!task.externalId) {
      skipped++;
      continue;
    }

    const disposition = mapTaskStatus(task.status);
    if (disposition === "drop") {
      removals.push(task.externalId);
      continue;
    }

    if (!task.dueDate || !task.title) {
      skipped++;
      continue;
    }

    upserts.push({
      externalId: task.externalId,
      title: task.title,
      dueDate: task.dueDate,
      status: disposition,
    });
  }

  return { upserts, removals, skipped };
}

/** Resumo em português do que a sincronização fez, para a tela e o log. */
export function describeSyncResult(result: {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
}): string {
  const parts: string[] = [];
  if (result.created > 0) parts.push(`${result.created} criada${result.created === 1 ? "" : "s"}`);
  if (result.updated > 0) parts.push(`${result.updated} atualizada${result.updated === 1 ? "" : "s"}`);
  if (result.removed > 0) parts.push(`${result.removed} removida${result.removed === 1 ? "" : "s"}`);
  if (result.skipped > 0)
    parts.push(`${result.skipped} ignorada${result.skipped === 1 ? "" : "s"} por falta de vencimento`);

  if (parts.length === 0) return "Nenhuma obrigação para sincronizar.";
  return `Obrigações sincronizadas: ${parts.join(", ")}.`;
}
