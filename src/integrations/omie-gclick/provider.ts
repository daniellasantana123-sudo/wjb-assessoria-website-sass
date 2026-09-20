import "server-only";

import { getGClickConfig } from "./config";
import { createGClickHttpProvider } from "./http.provider";
import { createMockGClickProvider } from "./mock.provider";
import type { OmieGClickAdapter } from "./types";

/**
 * Factory / seleção de provider (seção 10 do prompt da Fase 6.5).
 * `GCLICK_MODE` decide qual implementação `getOmieGClickAdapter()`
 * devolve:
 *
 * - "mock" (padrão, sem nenhuma env var) -> `MockGClickProvider`,
 *   totalmente funcional, em memória, nunca chama rede.
 * - "sandbox"/"production" -> `GClickHttpProvider`, que hoje SEMPRE
 *   bloqueia (nenhuma chamada de rede real existe ainda, ver
 *   `http.provider.ts`) - independente de `GCLICK_REAL_INTEGRATION_ENABLED`,
 *   porque não há implementação real a habilitar. A flag existe como
 *   proteção preparada para quando existir (se alguém marcar
 *   `GCLICK_MODE=production` sem também marcar a flag, o log abaixo
 *   deixa isso claro; com a flag marcada, o comportamento é o mesmo hoje
 *   - ainda bloqueado -, só muda quando uma implementação real for
 *   escrita em `http.provider.ts`).
 *
 * Memoizado por processo (mesmo padrão dos outros adapters do projeto) -
 * `resetOmieGClickAdapterForTests()` existe só pra testes trocarem de
 * modo sem reiniciar o processo.
 */
let cached: OmieGClickAdapter | null = null;

export function getOmieGClickAdapter(): OmieGClickAdapter {
  if (cached) return cached;

  const config = getGClickConfig();

  if (config.mode === "mock") {
    cached = createMockGClickProvider();
    return cached;
  }

  if (!config.realIntegrationEnabled) {
    console.warn(
      `[gclick] GCLICK_MODE="${config.mode}" mas GCLICK_REAL_INTEGRATION_ENABLED != "true" - caindo no provider bloqueado.`,
    );
  }

  cached = createGClickHttpProvider(config);
  return cached;
}

/** Só para testes - força a factory a reavaliar a config na próxima chamada. */
export function resetOmieGClickAdapterForTests(): void {
  cached = null;
}

/**
 * Sempre `false` hoje - não existe nenhuma implementação real
 * (`GClickHttpProvider` sempre bloqueia, independente de credenciais).
 * Mantido como função (não inline na UI) pra ter um único lugar a mudar
 * quando isso deixar de ser verdade.
 */
export function isOmieConfigured(): boolean {
  return false;
}
