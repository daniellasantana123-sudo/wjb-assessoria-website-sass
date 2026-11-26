import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import type { GateAuditSink } from "@/lib/wjb-ai/fiscal/national/transmission-gate";

/**
 * Registra no `audit_log` cada transmissão oficial bloqueada pelo portão
 * (Fase 10B). Só códigos, ambiente e origem: nada de empresa, pessoa,
 * documento ou segredo. Rotina automática: sem autor.
 */
export function createSupabaseGateAuditSink(): GateAuditSink {
  return {
    async blocked({ environment, codes, origin }) {
      const supabase = createAdminClient();
      await supabase.from("audit_log").insert({
        actor_id: null,
        tenant_id: null,
        action: "fiscal.transmission_blocked",
        entity: "fiscal_transmission_gate",
        entity_id: null,
        metadata: { environment, codes, origin },
      });
    },
  };
}
