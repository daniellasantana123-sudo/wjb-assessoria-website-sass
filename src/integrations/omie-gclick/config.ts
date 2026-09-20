import "server-only";

import type { ProviderMode } from "./types";

export interface GClickConfig {
  mode: ProviderMode;
  /**
   * Trava de segurança extra (seção 11 do prompt da Fase 6.5): mesmo que
   * `mode` seja "production", a integração real só seria considerada
   * habilitada com isto também `true`. Hoje não tem efeito prático - não
   * existe implementação real (`GClickHttpProvider` sempre bloqueia) -,
   * é uma proteção contra ativação acidental preparada para quando
   * existir.
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

function parseMode(raw: string | undefined): ProviderMode {
  if (raw === "sandbox" || raw === "production") return raw;
  return "mock"; // padrão seguro - nunca cair em modo real por omissão de env var.
}

function parseTimeout(raw: string | undefined): number {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
}

export function getGClickConfig(): GClickConfig {
  return {
    mode: parseMode(process.env.GCLICK_MODE),
    realIntegrationEnabled: process.env.GCLICK_REAL_INTEGRATION_ENABLED === "true",
    baseUrl: process.env.GCLICK_BASE_URL || undefined,
    clientId: process.env.GCLICK_CLIENT_ID || undefined,
    clientSecret: process.env.GCLICK_CLIENT_SECRET || undefined,
    apiKey: process.env.GCLICK_API_KEY || undefined,
    token: process.env.GCLICK_TOKEN || undefined,
    timeoutMs: parseTimeout(process.env.GCLICK_TIMEOUT_MS),
  };
}
