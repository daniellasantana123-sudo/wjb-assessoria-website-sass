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

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}
