import "server-only";

import type { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import type { ExternalClient, ProviderResult } from "@/integrations/omie-gclick/types";

type Adapter = ReturnType<typeof getOmieGClickAdapter>;

const MAX_PAGES = 15;
const PAGE_SIZE = 100;
const CACHE_MS = 60_000;

const cache = new WeakMap<Adapter, { at: number; clients: ExternalClient[] }>();

/**
 * Todos os clientes da conta do G-Click (2026-10-01), para a busca da
 * plataforma e para a tela de importação.
 *
 * A busca da API (`/clientes/search`) só olha a razão social, então quem
 * procura pelo CNPJ ou pelo nome fantasia não acha nada. A saída é ler a
 * lista completa e filtrar aqui (`clientMatches`).
 *
 * - Lista paginada de `/clientes` (paginação começa em 0 - Spring).
 * - Se a lista falhar (já aconteceu: um cadastro com status inválido
 *   derrubava a listagem inteira), usa a carteira, que também traz id,
 *   nome, nome fantasia e CNPJ.
 * - Guarda o resultado por 1 minuto por adaptador, para várias buscas
 *   seguidas não repetirem as mesmas chamadas.
 */
export async function loadAllGClickClients(
  adapter: Adapter,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<ProviderResult<ExternalClient[]> & { truncated?: boolean }> {
  const hit = cache.get(adapter);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return { ok: true, data: hit.clients };

  const clients: ExternalClient[] = [];
  let listFailed = false;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await adapter.clients.list({ page, pageSize: PAGE_SIZE });
    if (!result.ok) {
      listFailed = true;
      break;
    }
    clients.push(...result.data.items);
    if (result.data.items.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  if (listFailed) {
    const portfolio = await adapter.catalog.portfolio();
    if (!portfolio.ok) return portfolio;
    // A carteira repete o cliente uma vez por responsável.
    const seen = new Set<string>();
    for (const item of portfolio.data) {
      if (!item.clientExternalId || seen.has(item.clientExternalId)) continue;
      seen.add(item.clientExternalId);
      clients.push({
        internalId: "",
        externalId: item.clientExternalId,
        externalReference: "",
        name: item.name,
        tradeName: item.tradeName ?? null,
        document: item.document,
        status: null,
        metadata: null,
        createdAt: null,
        updatedAt: null,
      });
    }
  }

  cache.set(adapter, { at: Date.now(), clients });
  return { ok: true, data: clients, truncated };
}
