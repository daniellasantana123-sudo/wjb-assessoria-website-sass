import "server-only";

import type { ProviderMode } from "./types";

export interface GClickConfig {
  mode: ProviderMode;
  /**
   * `GCLICK_MODE` continha um valor que não é "mock"/"sandbox"/"production"
   * - `mode` já caiu em "mock" (seguro), mas isto sinaliza que o valor não
   * deveria ter sido ignorado silenciosamente (Checkpoint 6.5.1, seção 10:
   * "GCLICK_MODE=abc deve gerar erro de configuração claro"). O factory
   * (`provider.ts`) loga isto como `console.error` - não lança exceção,
   * pra nunca derrubar login/Dashboard/Documentos por um erro de digitação
   * numa env var de uma integração opcional (mesma prioridade de
   * resiliência já estabelecida em toda esta integração).
   */
  modeConfigError: string | null;
  /**
   * Proteção 1 de 2 (Checkpoint 6.5.1, seções 1/2): decide, no factory,
   * se sequer se tenta um provider "sandbox"/"production" - com isto
   * `false` (padrão), qualquer tentativa de sair do modo mock é bloqueada
   * já aqui. Independente da Proteção 2 (`REAL_PROVIDER_IMPLEMENTED`,
   * hardcoded em `http.provider.ts`) - as duas precisam ser verdadeiras
   * pra uma chamada real algum dia acontecer, e hoje nenhuma das duas é.
   */
  realIntegrationEnabled: boolean;
  /** TODO_GCLICK_VALIDATION - host real nunca confirmado nesta sessão. */
  baseUrl: string | undefined;
  /** TODO_GCLICK_VALIDATION - nome do campo não confirmado (poderia ser outro). */
  clientId: string | undefined;
  /** TODO_GCLICK_VALIDATION - nome do campo não confirmado. */
  clientSecret: string | undefined;
  /** TODO_GCLICK_VALIDATION - alternativa candidata caso o modelo real não seja client_id/secret. */
  apiKey: string | undefined;
  /** TODO_GCLICK_VALIDATION - token já emitido, se o fluxo real permitir configurar um diretamente. */
  token: string | undefined;
  timeoutMs: number;
}

function parseMode(raw: string | undefined): { mode: ProviderMode; modeConfigError: string | null } {
  if (raw === undefined || raw === "" || raw === "mock") {
    return { mode: "mock", modeConfigError: null };
  }
  if (raw === "sandbox" || raw === "production") {
    return { mode: raw, modeConfigError: null };
  }
  return {
    mode: "mock",
    modeConfigError: `GCLICK_MODE="${raw}" não é válido (use "mock", "sandbox" ou "production") - caindo em "mock" por segurança.`,
  };
}

function parseTimeout(raw: string | undefined): number {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
}

export function getGClickConfig(): GClickConfig {
  const { mode, modeConfigError } = parseMode(process.env.GCLICK_MODE);
  return {
    mode,
    modeConfigError,
    realIntegrationEnabled: process.env.GCLICK_REAL_INTEGRATION_ENABLED === "true",
    baseUrl: process.env.GCLICK_BASE_URL || undefined,
    clientId: process.env.GCLICK_CLIENT_ID || undefined,
    clientSecret: process.env.GCLICK_CLIENT_SECRET || undefined,
    apiKey: process.env.GCLICK_API_KEY || undefined,
    token: process.env.GCLICK_TOKEN || undefined,
    timeoutMs: parseTimeout(process.env.GCLICK_TIMEOUT_MS),
  };
}
