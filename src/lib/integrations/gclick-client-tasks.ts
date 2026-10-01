import "server-only";

import type { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import type { ExternalTask } from "@/integrations/omie-gclick/types";
import { documentsMatch } from "@/lib/integrations/client-search";

type Adapter = ReturnType<typeof getOmieGClickAdapter>;
type Category = "Obrigacao" | "Solicitacao";

const MAX_PAGES = 10;
const PAGE_SIZE = 100;
const CACHE_MS = 2 * 60_000;
const cache = new WeakMap<Adapter, Map<Category, { at: number; tasks: ExternalTask[]; truncated: boolean }>>();

async function loadCategory(adapter: Adapter, category: Category) {
  const perAdapter = cache.get(adapter) ?? new Map();
  cache.set(adapter, perAdapter);
  const hit = perAdapter.get(category);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true as const, ...hit };

  const tasks: ExternalTask[] = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await adapter.tasks.list({ page, pageSize: PAGE_SIZE, category });
    if (!result.ok) {
      if (page === 0) return { ok: false as const, error: result.error };
      break;
    }
    tasks.push(...result.data.items.map((task) => ({ ...task, category })));
    if (result.data.items.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  const entry = { at: Date.now(), tasks, truncated };
  perAdapter.set(category, entry);
  return { ok: true as const, ...entry };
}

/**
 * Todas as tarefas de um cliente no G-Click - obrigações e solicitações -
 * dos últimos 12 meses (2026-10-01, para a ficha da empresa no Admin).
 *
 * `GET /tarefas` devolve a conta inteira (não filtra por cliente), então
 * lê as duas categorias e filtra aqui pelo id OU pelo CNPJ (mesma regra da
 * sincronização de obrigações). Guarda 2 minutos por categoria, para abrir
 * várias fichas seguidas não repetir a leitura. Só leitura.
 */
export async function loadClientGClickTasks(
  adapter: Adapter,
  client: { externalId: string; document: string | null },
): Promise<{ ok: true; tasks: ExternalTask[]; truncated: boolean } | { ok: false; message: string }> {
  const [obligations, requests] = await Promise.all([
    loadCategory(adapter, "Obrigacao"),
    loadCategory(adapter, "Solicitacao"),
  ]);
  if (!obligations.ok && !requests.ok) {
    return { ok: false, message: obligations.error.message };
  }

  const all = [...(obligations.ok ? obligations.tasks : []), ...(requests.ok ? requests.tasks : [])];
  const tasks = all
    .filter(
      (task) =>
        task.clientExternalId === client.externalId ||
        documentsMatch(task.clientDocument, client.document),
    )
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  return {
    ok: true,
    tasks,
    truncated: Boolean((obligations.ok && obligations.truncated) || (requests.ok && requests.truncated)),
  };
}
