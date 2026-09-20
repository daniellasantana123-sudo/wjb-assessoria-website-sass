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

export interface AuditLogFilters {
  tenantId?: string;
  /** Casa contra nome ou e-mail do autor (Fase 5 - "filtro por usuário"). */
  actorQuery?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Filtros por empresa/usuário/ação/período (Fase 5 do wjb-saas-mvp,
 * 2026-09-20 - Console Admin WJB). `actorQuery` não dá pra filtrar direto
 * na mesma query (PostgREST não filtra por coluna de uma relação embutida
 * sem `!inner`, e ainda precisaria de `or` entre `full_name`/`email`) -
 * resolvido buscando os `profiles` que batem primeiro, depois filtrando
 * `audit_log` por `actor_id in (...)`. Mesmo padrão de busca já usado em
 * `listTenantDocuments` (`ilike`).
 */
export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const supabase = await createClient();

  let actorIds: string[] | null = null;
  if (filters.actorQuery) {
    // 2 buscas separadas (nome, e-mail) em vez de `.or()` com string
    // interpolada - evita que `,`/`(`/`)` no termo de busca quebrem a
    // sintaxe do filtro do PostgREST.
    const [byName, byEmail] = await Promise.all([
      supabase.from("profiles").select("id").ilike("full_name", `%${filters.actorQuery}%`).limit(50),
      supabase.from("profiles").select("id").ilike("email", `%${filters.actorQuery}%`).limit(50),
    ]);
    actorIds = [
      ...new Set([...(byName.data ?? []), ...(byEmail.data ?? [])].map((row) => row.id)),
    ];
    if (actorIds.length === 0) return [];
  }

  let query = supabase
    .from("audit_log")
    .select(
      "id, action, entity, entity_id, metadata, created_at, profiles(full_name, email), tenants(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.tenantId) query = query.eq("tenant_id", filters.tenantId);
  if (filters.action) query = query.eq("action", filters.action);
  if (actorIds) query = query.in("actor_id", actorIds);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);

  const { data } = await query;

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

export interface TenantOption {
  id: string;
  name: string;
}

/** Lista enxuta pro `<select>` de filtro por empresa - staff-only, sem paginação (mesmo volume de `/admin/empresas`). */
export async function listTenantOptions(): Promise<TenantOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("id, name").order("name");
  return data ?? [];
}
