import "server-only";

import { noopAntivirusAdapter } from "./noop.adapter";
import type { AntivirusAdapter } from "./types";

let cached: AntivirusAdapter | null = null;

/**
 * Sempre retorna o adapter no-op hoje — nenhum provider de antivírus foi
 * confirmado (ver `types.ts`). Mesma factory com cache em módulo dos
 * outros providers (`email`, `whatsapp-business`), pronta pra decidir por
 * env var quando um provider real existir.
 */
export function getAntivirusAdapter(): AntivirusAdapter {
  if (cached) return cached;
  cached = noopAntivirusAdapter;
  return cached;
}
