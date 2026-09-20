import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { OmieIntegrationStatus } from "@/types/database";

export interface OmieMapping {
  tenantId: string;
  externalClientId: string | null;
  externalPortalUrl: string | null;
  status: OmieIntegrationStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/**
 * Lê o mapeamento Omie.G-Click do tenant — RLS (`0017_omie_gclick_integration.sql`)
 * já garante que staff vê qualquer um e cliente só vê o da própria empresa.
 * Retorna `null` tanto pra "nunca configurado" quanto pra "sem acesso" — o
 * chamador não precisa (nem deve) distinguir os dois casos.
 */
export async function getOmieMapping(tenantId: string): Promise<OmieMapping | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("omie_client_mappings")
    .select("tenant_id, external_client_id, external_portal_url, status, last_synced_at, last_error")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data) return null;

  return {
    tenantId: data.tenant_id,
    externalClientId: data.external_client_id,
    externalPortalUrl: data.external_portal_url,
    status: data.status,
    lastSyncedAt: data.last_synced_at,
    lastError: data.last_error,
  };
}
