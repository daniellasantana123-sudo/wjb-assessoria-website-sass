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
  /** Quantas tarefas vieram do G-Click no total, de todos os clientes. */
  examined: number;
  /** Quantas dessas eram desta empresa. */
  matched: number;
}

/** Como identificar as tarefas desta empresa entre as da conta inteira. */
export interface TenantMatch {
  clientExternalId: string;
  /** CNPJ da empresa na plataforma, quando houver. */
  document?: string | null;
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
  tenant: TenantMatch,
): TaskPlan {
  const upserts: ObligationFromTask[] = [];
  const removals: string[] = [];
  let skipped = 0;
  let matched = 0;

  for (const task of tasks) {
    if (!belongsToTenant(task, tenant)) continue;
    matched++;
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

  return { upserts, removals, skipped, examined: tasks.length, matched };
}

/**
 * A tarefa é desta empresa?
 *
 * Aceita duas chaves, e basta uma bater: o **id** do cliente no G-Click
 * (o que foi vinculado no painel) ou a **inscrição** que a própria tarefa
 * carrega. Duas chaves porque cada uma falha de um jeito diferente - um id
 * vinculado errado deixaria de fora tarefas que são da empresa, e um
 * cadastro sem CNPJ no G-Click deixaria o documento em branco. Nenhuma das
 * duas é frouxa: id e CNPJ identificam uma empresa só.
 */
function belongsToTenant(task: ExternalTask, tenant: TenantMatch): boolean {
  if (task.clientExternalId === tenant.clientExternalId) return true;
  return documentsMatch(task.clientDocument, tenant.document ?? null);
}

/** Mesmo CNPJ, mesmo escrito de formas diferentes entre os dois sistemas. */
function documentsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = a.replace(/\D/g, "");
  const right = b.replace(/\D/g, "");
  return left.length > 0 && left === right;
}

/**
 * Resumo em português do que a sincronização fez, para a tela e o log.
 *
 * Distingue os dois casos de "nada aconteceu", que antes caíam na mesma
 * frase genérica e não ajudavam ninguém a entender o motivo: **não havia
 * tarefa nenhuma** no período, ou **havia tarefas, mas de outras
 * empresas**. São problemas diferentes - o primeiro se resolve no
 * G-Click, o segundo é sinal de vínculo errado.
 */
export function describeSyncResult(result: {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  examined: number;
  matched: number;
}): string {
  const parts: string[] = [];
  if (result.created > 0) parts.push(`${result.created} criada${result.created === 1 ? "" : "s"}`);
  if (result.updated > 0) parts.push(`${result.updated} atualizada${result.updated === 1 ? "" : "s"}`);
  if (result.removed > 0) parts.push(`${result.removed} removida${result.removed === 1 ? "" : "s"}`);
  if (result.skipped > 0)
    parts.push(`${result.skipped} ignorada${result.skipped === 1 ? "" : "s"} por falta de vencimento`);

  if (parts.length > 0) return `Obrigações sincronizadas: ${parts.join(", ")}.`;

  if (result.examined === 0) {
    return "O G-Click não retornou nenhuma tarefa no período consultado (últimos 12 meses, categoria Obrigação).";
  }

  if (result.matched === 0) {
    return `Foram lidas ${result.examined} tarefa${result.examined === 1 ? "" : "s"} no G-Click, mas nenhuma está vinculada a esta empresa. Confira se o cliente selecionado é o correto.`;
  }

  return `${result.matched} tarefa${result.matched === 1 ? "" : "s"} desta empresa já estava${result.matched === 1 ? "" : "m"} em dia - nada a alterar.`;
}
