import "server-only";

import { createOmieAdapter } from "./omie.adapter";
import type { OmieClientInput, OmieClientResult, OmieGClickAdapter } from "./types";

/**
 * Sem `OMIE_APP_KEY`/`OMIE_APP_SECRET` configuradas, cai num adapter no-op
 * que só loga — mesmo padrão de `getEmailAdapter()`/`getWhatsAppBusinessAdapter()`,
 * nunca quebra quem chamou. Resultado sempre `ok: false` com um erro
 * explícito, nunca lança exceção — a resiliência exigida pela Fase 4
 * ("Omie indisponível não pode derrubar login, documentos ou Dashboard")
 * é garantida em dois níveis: este fallback nunca lança, e nenhum caminho
 * crítico (login, documentos, dashboard) chama este adapter — só a ação
 * explícita de staff "Sincronizar com Omie.G-Click".
 */
const noopAdapter: OmieGClickAdapter = {
  async upsertClient(input: OmieClientInput): Promise<OmieClientResult> {
    console.log(
      `[omie-gclick:noop] OMIE_APP_KEY/OMIE_APP_SECRET não configuradas — cliente do tenant ${input.tenantId} não sincronizado`,
    );
    return { ok: false, error: "no-provider" };
  },
};

let cached: OmieGClickAdapter | null = null;

export function getOmieGClickAdapter(): OmieGClickAdapter {
  if (cached) return cached;

  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;
  cached = appKey && appSecret ? createOmieAdapter(appKey, appSecret) : noopAdapter;
  return cached;
}
