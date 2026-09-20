import "server-only";

import type { ProviderError } from "../types";

/**
 * GClickErrorMapper (seção 34 do prompt da Fase 6.5) - esqueleto.
 * Traduziria o formato de erro real da G-Click (código HTTP? corpo com
 * `faultstring`-like? outro?) pro `ProviderError` interno (seção 17).
 * Não confirmado nesta sessão - ver
 * `docs/integrations/gclick/PENDING_VALIDATION.md`. Não assumir que a
 * G-Click responde `409` pra duplicidade (regra explícita da seção 16 do
 * prompt) nem qualquer outro código HTTP específico.
 */
export function fromExternalError(payload: unknown): ProviderError {
  void payload;
  throw new Error(
    "GClickErrorMapper.fromExternalError: formato de erro da API não confirmado (TODO_GCLICK_VALIDATION).",
  );
}
