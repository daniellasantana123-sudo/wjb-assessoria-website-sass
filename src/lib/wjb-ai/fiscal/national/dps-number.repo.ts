import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import type { DpsNumberAllocator } from "@/lib/wjb-ai/fiscal/national/provider";

/**
 * Numeração persistente da DPS (migration 0027). Só o servidor (service
 * role) executa `allocate_dps_number`; a função trava a linha da série,
 * devolve o MESMO número para o mesmo pedido e o banco garante que um
 * número nunca vai para dois pedidos.
 */
export class SupabaseDpsNumberAllocator implements DpsNumberAllocator {
  constructor(private readonly environment: "simulado" | "producao_restrita") {}

  private async requestId(tenantId: string, key: string): Promise<string> {
    const { data, error } = await createAdminClient()
      .from("fiscal_requests")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", key)
      .single();
    if (error || !data) throw new Error("Pedido fiscal não encontrado.");
    return data.id;
  }

  async numberFor(tenantId: string, key: string) {
    const id = await this.requestId(tenantId, key);
    const { data, error } = await createAdminClient().rpc(
      "allocate_dps_number",
      { p_request_id: id, p_environment: this.environment },
    );
    const row = data?.[0];
    if (error || !row) throw new Error("Não foi possível numerar a DPS.");
    return { series: row.series, number: Number(row.number) };
  }

  async existing(tenantId: string, key: string) {
    const id = await this.requestId(tenantId, key);
    const { data } = await createAdminClient()
      .from("fiscal_dps_numbers")
      .select("series, number, environment")
      .eq("request_id", id)
      .maybeSingle();
    if (!data || data.environment !== this.environment) return null;
    return { series: data.series, number: Number(data.number) };
  }
}
