import { createHash } from "node:crypto";

import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";

/**
 * Chave de idempotência criada NO SERVIDOR a partir do snapshot imutável do
 * rascunho + empresa da sessão. Mesmo pedido repetido = mesma chave.
 *
 * Duas prestações legítimas e idênticas são possíveis (seção 7.4), por isso a
 * mesma chave sinaliza "possível duplicidade" para revisão, não bloqueio
 * automático; o `sourceReference` do cliente diferencia pedidos de propósito.
 */
export function buildIdempotencyKey(
  tenantId: string,
  draft: NormalizedNfseDraft,
): string {
  const canonical = JSON.stringify([
    "nfse-v1",
    tenantId,
    draft.taker.document,
    draft.amountCents,
    draft.competence,
    draft.serviceDescription.trim().replace(/\s+/g, " ").toLowerCase(),
    draft.sourceReference ?? "",
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
