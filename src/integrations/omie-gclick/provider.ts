import "server-only";

import { getGClickConfig } from "./config";
import { createGClickHttpProvider } from "./http.provider";
import { createMockGClickProvider } from "./mock.provider";
import type { OmieGClickAdapter } from "./types";

/**
 * Factory / seleção de provider (seção 10 do prompt da Fase 6.5, endurecida
 * no Checkpoint 6.5.1). `GCLICK_MODE` decide qual implementação
 * `getOmieGClickAdapter()` devolve:
 *
 * - "mock" (padrão, sem nenhuma env var, ou valor inválido - ver
 *   `config.ts::parseMode`) -> `MockGClickProvider`, totalmente
 *   funcional, em memória, nunca chama rede, NUNCA exige nenhuma
 *   credencial `GCLICK_*`.
 * - "sandbox"/"production" -> `GClickHttpProvider`, que hoje SEMPRE
 *   bloqueia - duas proteções independentes (`http.provider.ts`):
 *   1. `GCLICK_REAL_INTEGRATION_ENABLED` (decidida aqui, vira
 *      `blockedByFeatureFlag`);
 *   2. `REAL_PROVIDER_IMPLEMENTED` (hardcoded em `http.provider.ts`,
 *      nunca lida de env var - só uma mudança de código a libera).
 *   As duas precisam estar "abertas" pra uma chamada real algum dia
 *   acontecer; hoje a Proteção 2 sozinha já garante que isso nunca
 *   acontece, mesmo que alguém configure a Proteção 1.
 *
 * Memoizado por processo (mesmo padrão dos outros adapters do projeto) -
 * `resetOmieGClickAdapterForTests()` existe só pra testes trocarem de
 * modo sem reiniciar o processo.
 */
let cached: OmieGClickAdapter | null = null;

export function getOmieGClickAdapter(): OmieGClickAdapter {
  if (cached) return cached;

  const config = getGClickConfig();

  if (config.modeConfigError) {
    console.error(`[gclick] ${config.modeConfigError}`);
  }

  if (config.mode === "mock") {
    cached = createMockGClickProvider();
    return cached;
  }

  const blockedByFeatureFlag = !config.realIntegrationEnabled;
  if (blockedByFeatureFlag) {
    console.warn(
      `[gclick] GCLICK_MODE="${config.mode}" mas GCLICK_REAL_INTEGRATION_ENABLED != "true" - bloqueado (Proteção 1 de 2).`,
    );
  }

  cached = createGClickHttpProvider(config, { blockedByFeatureFlag });
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
