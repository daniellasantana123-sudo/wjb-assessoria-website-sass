import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  tenantName: string | null;
}

/** Últimas 100 entradas — sem paginação ainda, volume real não justifica por enquanto. */
export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select(
      "id, action, entity, entity_id, metadata, created_at, profiles(full_name, email), tenants(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) return [];

  return data.map((row) => {
    const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorName: actor?.full_name ?? null,
      actorEmail: actor?.email ?? null,
      tenantName: tenant?.name ?? null,
    };
  });
}
