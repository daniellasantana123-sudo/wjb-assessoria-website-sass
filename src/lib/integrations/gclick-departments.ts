import "server-only";

import { getGClickConfig, type getOmieGClickAdapter } from "@/integrations/omie-gclick";

type Adapter = ReturnType<typeof getOmieGClickAdapter>;
export type GClickDepartment = { id: number; name: string };

const PAGES_PER_CATEGORY = 5;
const PAGE_SIZE = 100;
const CACHE_MS = 10 * 60_000;
const cache = new WeakMap<Adapter, { at: number; departments: GClickDepartment[] }>();

/**
 * Departamentos da conta do G-Click, descobertos pelas próprias tarefas
 * (2026-10-01). `GET /departamentos` é exclusivo de parceiros da Omie, mas
 * cada tarefa traz o departamento dela (`obrigacao.departamento`). Lê até
 * 500 tarefas de cada categoria dos últimos 12 meses - suficiente para
 * achar todos os departamentos em uso - e guarda por 10 minutos.
 */
export async function discoverGClickDepartments(adapter: Adapter): Promise<GClickDepartment[]> {
  const hit = cache.get(adapter);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.departments;

  const found = new Map<number, string>();
  for (const category of ["Obrigacao", "Solicitacao"] as const) {
    for (let page = 0; page < PAGES_PER_CATEGORY; page++) {
      const result = await adapter.tasks.list({ page, pageSize: PAGE_SIZE, category });
      if (!result.ok) break;
      for (const task of result.data.items) {
        if (task.department && !found.has(task.department.id)) {
          found.set(task.department.id, task.department.name);
        }
      }
      if (result.data.items.length < PAGE_SIZE) break;
    }
  }

  const departments = [...found.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  cache.set(adapter, { at: Date.now(), departments });
  return departments;
}

/**
 * Departamentos oferecidos ao criar tarefa: os configurados em
 * `GCLICK_DEPARTAMENTOS` têm prioridade (permite limitar a lista); sem
 * configuração, usa os descobertos nas tarefas.
 */
export async function getTaskDepartments(adapter: Adapter): Promise<{
  departments: GClickDepartment[];
  source: "config" | "discovered";
}> {
  const configured = getGClickConfig().account.departments;
  if (configured.length > 0) return { departments: configured, source: "config" };
  return { departments: await discoverGClickDepartments(adapter), source: "discovered" };
}
