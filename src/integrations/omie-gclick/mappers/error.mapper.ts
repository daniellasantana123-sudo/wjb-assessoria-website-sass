import "server-only";

import type { ProviderError, ProviderErrorCode } from "../types";

/**
 * GClickErrorMapper - traduz a resposta de erro real da G-Click pro
 * `ProviderError` interno (seção 17). A coleção oficial não documenta um
 * envelope de erro padrão, então o mapeamento é **pelo status HTTP**, que
 * é o que dá pra afirmar com segurança; o corpo só é usado pra enriquecer
 * a mensagem quando vier num formato reconhecível.
 *
 * Regra herdada da Fase 6.5 e mantida: a mensagem devolvida é sempre
 * segura de logar/exibir - nunca o corpo bruto do provider, que pode
 * carregar dado de cliente ou eco de credencial.
 */
const BY_STATUS: Record<number, { code: ProviderErrorCode; message: string }> =
  {
    400: {
      code: "VALIDATION_ERROR",
      message: "O G-Click recusou os dados enviados.",
    },
    401: {
      code: "AUTHENTICATION_ERROR",
      message: "Credenciais do G-Click inválidas ou expiradas.",
    },
    403: {
      code: "AUTHORIZATION_ERROR",
      message: "Sem permissão para esta operação no G-Click.",
    },
    404: { code: "NOT_FOUND", message: "Registro não encontrado no G-Click." },
    409: {
      code: "DUPLICATE",
      message: "Já existe um registro equivalente no G-Click.",
    },
    422: {
      code: "VALIDATION_ERROR",
      message: "O G-Click recusou os dados enviados.",
    },
    429: {
      code: "RATE_LIMITED",
      message: "Limite de requisições do G-Click atingido.",
    },
  };

/**
 * Extrai uma mensagem curta do corpo, quando houver. Campos tentados na
 * ordem em que aparecem em APIs Spring (que é o que o G-Click parece
 * usar, pelo formato paginado `content`/`totalElements`).
 */
function extractDetail(body: unknown): string | null {
  if (typeof body === "string") return body.slice(0, 200) || null;
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  for (const key of [
    "message",
    "error_description",
    "error",
    "detail",
    "mensagem",
  ]) {
    const value = raw[key];
    if (typeof value === "string" && value.length > 0)
      return value.slice(0, 200);
  }
  return null;
}

export function fromExternalError(
  status: number,
  body: unknown,
  retryAfterMs?: number,
): ProviderError {
  const base = BY_STATUS[status] ?? {
    code:
      status >= 500
        ? ("UNAVAILABLE" as const)
        : ("UNKNOWN_PROVIDER_ERROR" as const),
    message:
      status >= 500
        ? "O G-Click está indisponível no momento."
        : "O G-Click respondeu um erro não esperado.",
  };

  const detail = extractDetail(body);
  return {
    code: base.code,
    message: detail ? `${base.message} (${detail})` : base.message,
    ...(base.code === "RATE_LIMITED" && retryAfterMs ? { retryAfterMs } : {}),
  };
}

/** Falha antes de ter resposta: timeout do `AbortController` ou rede fora. */
export function fromTransportError(error: unknown): ProviderError {
  const isAbort = error instanceof Error && error.name === "AbortError";
  return isAbort
    ? {
        code: "TIMEOUT",
        message: "O G-Click não respondeu dentro do tempo limite.",
      }
    : { code: "UNAVAILABLE", message: "Não foi possível falar com o G-Click." };
}
