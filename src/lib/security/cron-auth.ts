import { timingSafeEqual } from "node:crypto";

/**
 * Confere `Authorization: Bearer <CRON_SECRET>` em tempo constante (auditoria
 * de 21/11/2026: a comparação com `!==` vazava tempo). Mesmo comportamento
 * das rotas: quem chama decide 503 (sem segredo) e 401 (não autorizado).
 */
export function isCronAuthorized(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
