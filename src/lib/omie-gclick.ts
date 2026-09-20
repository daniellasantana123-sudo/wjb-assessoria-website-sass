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

export interface OmieMappingOverviewItem extends OmieMapping {
  tenantName: string;
}

/**
 * Visão geral de todos os mapeamentos (Fase 5 do wjb-saas-mvp - console
 * admin, "Omie: status, mapping"). Staff-only por natureza (RLS já só
 * devolve todas as linhas pra quem `is_staff()`) - um cliente que chamasse
 * isto só veria a própria empresa, nunca as outras.
 */
export async function listOmieMappings(): Promise<OmieMappingOverviewItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("omie_client_mappings")
    .select(
      "tenant_id, external_client_id, external_portal_url, status, last_synced_at, last_error, tenants(name)",
    )
    .order("last_synced_at", { ascending: false, nullsFirst: false });

  return (data ?? []).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      tenantId: row.tenant_id,
      tenantName: tenant?.name ?? "-",
      externalClientId: row.external_client_id,
      externalPortalUrl: row.external_portal_url,
      status: row.status,
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
    };
  });
}
