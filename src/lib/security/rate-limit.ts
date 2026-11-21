/**
 * Rate limit em memória, best-effort (seção 38). Funciona enquanto a
 * instância do processo Node estiver ativa; em hospedagem serverless com
 * cold starts frequentes isso reseta a qualquer momento — para algo durável
 * entre invocações, trocar por um store compartilhado (ex.: Upstash Redis)
 * quando o volume de leads justificar.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

/** `max` opcional (padrão 5/min): o chat do WJB AI usa um limite maior. */
export function isRateLimited(key: string, max: number = MAX_REQUESTS): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= max) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}
