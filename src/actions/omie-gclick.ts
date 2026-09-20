"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import { omieMappingSchema } from "@/lib/validation/omie-gclick";

export type OmieActionState = { error: string } | { success: string } | undefined;

/**
 * Fase 4 do wjb-saas-mvp — mapeamento por organization, nunca direto ao
 * user (ver `supabase/migrations/0017_omie_gclick_integration.sql`). Toda
 * ação aqui é staff-only: quem configura/aciona a integração é a WJB, não
 * a empresa cliente — a RLS (`omie_mappings_write_staff_only`) já garante
 * isso no banco, `hasPermission` é defesa em profundidade, mesmo padrão
 * de `src/actions/documents.ts`.
 */
export async function saveOmieMapping(
  tenantId: string,
  _prevState: OmieActionState,
  formData: FormData,
): Promise<OmieActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  const validated = omieMappingSchema.safeParse({
    externalClientId: formData.get("externalClientId"),
    externalPortalUrl: formData.get("externalPortalUrl"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const externalClientId = validated.data.externalClientId || null;
  const externalPortalUrl = validated.data.externalPortalUrl || null;
  const status = externalClientId ? "connected" : externalPortalUrl ? "pending" : "not_connected";

  const supabase = await createClient();
  const { error } = await supabase.from("omie_client_mappings").upsert(
    {
      tenant_id: tenantId,
      external_client_id: externalClientId,
      external_portal_url: externalPortalUrl,
      status,
      updated_by: session.userId,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    console.error("[omie-gclick] falha ao salvar mapeamento:", error);
    return { error: "Não foi possível salvar o mapeamento." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "integration.omie_mapping_updated",
    entity: "omie_client_mapping",
    entity_id: tenantId,
    metadata: { external_client_id: externalClientId, external_portal_url: externalPortalUrl, status },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  return { success: "Mapeamento salvo." };
}

/**
 * Sincroniza o cliente do tenant no Omie.G-Click via adapter. Sem
 * `OMIE_APP_KEY`/`OMIE_APP_SECRET` configuradas, o adapter no-op garante
 * que isso nunca lança — só retorna erro, tratado abaixo como qualquer
 * outra falha (resiliência exigida pela Fase 4).
 */
export async function syncOmieClient(tenantId: string): Promise<OmieActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, cnpj")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return { error: "Empresa não encontrada." };
  }

  const { data: mapping } = await supabase
    .from("omie_client_mappings")
    .select("external_client_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  await supabase.from("omie_client_mappings").upsert(
    { tenant_id: tenantId, status: "syncing", updated_by: session.userId },
    { onConflict: "tenant_id" },
  );

  const result = await getOmieGClickAdapter().upsertClient({
    tenantId: tenant.id,
    name: tenant.name,
    cnpj: tenant.cnpj,
    externalClientId: mapping?.external_client_id ?? null,
  });

  await supabase.from("omie_client_mappings").upsert(
    {
      tenant_id: tenantId,
      external_client_id: result.externalClientId ?? mapping?.external_client_id ?? null,
      status: result.ok ? "synced" : "error",
      last_synced_at: result.ok ? new Date().toISOString() : undefined,
      last_error: result.ok ? null : (result.error ?? "unknown-error"),
      updated_by: session.userId,
    },
    { onConflict: "tenant_id" },
  );

  // Log sanitizado: só o resultado (ok/erro), nunca as credenciais nem a resposta bruta da API.
  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "integration.omie_sync_attempted",
    entity: "omie_client_mapping",
    entity_id: tenantId,
    metadata: { ok: result.ok, error: result.error },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);

  if (!result.ok) {
    return { error: `Falha ao sincronizar com o Omie.G-Click (${result.error ?? "erro desconhecido"}).` };
  }
  return { success: "Sincronizado com o Omie.G-Click." };
}

/** Desativa/reativa a integração para um tenant específico, sem apagar o mapeamento salvo. */
export async function setOmieMappingDisabled(tenantId: string, disabled: boolean) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) return;

  const supabase = await createClient();
  const { data: mapping } = await supabase
    .from("omie_client_mappings")
    .select("external_client_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const reactivatedStatus = mapping?.external_client_id ? "connected" : "pending";

  await supabase.from("omie_client_mappings").upsert(
    {
      tenant_id: tenantId,
      status: disabled ? "disabled" : reactivatedStatus,
      updated_by: session.userId,
    },
    { onConflict: "tenant_id" },
  );

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: disabled ? "integration.omie_disabled" : "integration.omie_reactivated",
    entity: "omie_client_mapping",
    entity_id: tenantId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}
