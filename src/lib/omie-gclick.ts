import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getOmieGClickAdapter,
  type ExternalPerson,
  type ExternalTaskActivity,
} from "@/integrations/omie-gclick";
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

export interface ObligationProgress {
  activities: ExternalTaskActivity[];
  responsibles: ExternalPerson[];
}

/**
 * Andamento de uma obrigação vinda do G-Click: as etapas da tarefa e quem
 * é responsável por ela (2026-09-24).
 *
 * Consultado ao vivo, não espelhado no banco: etapa é informação que muda
 * durante o dia de trabalho da equipe, e guardar uma cópia significaria
 * mostrar ao cliente um andamento velho até a próxima sincronização - pior
 * do que não mostrar.
 *
 * Devolve `null` em qualquer falha (integração desligada, G-Click fora do
 * ar, tarefa removida de lá). A página trata isso como "andamento
 * indisponível" e continua mostrando a obrigação: o prazo e o status vêm
 * do nosso banco e não dependem desta chamada.
 */
export async function getObligationProgress(
  externalId: string,
): Promise<ObligationProgress | null> {
  if (!(await isFeatureEnabled("omie_gclick"))) return null;

  const adapter = getOmieGClickAdapter();
  const [activities, responsibles] = await Promise.all([
    adapter.tasks.listActivities(externalId),
    adapter.tasks.listResponsibles(externalId),
  ]);

  if (!activities.ok && !responsibles.ok) return null;

  return {
    activities: activities.ok ? activities.data : [],
    responsibles: responsibles.ok ? responsibles.data : [],
  };
}

/**
 * Quem, na WJB, é responsável pela empresa - lido do G-Click (2026-09-24).
 *
 * Ao vivo pelo mesmo motivo do andamento: responsável muda quando a equipe
 * se reorganiza, e uma cópia no banco envelheceria sem ninguém perceber.
 *
 * `null` quando não há vínculo com o G-Click, a integração está desligada
 * ou a consulta falha - a tela simplesmente não mostra o bloco, em vez de
 * exibir um erro que o cliente não pode resolver.
 */
export async function getTenantAccountManagers(
  tenantId: string,
): Promise<ExternalPerson[] | null> {
  if (!(await isFeatureEnabled("omie_gclick"))) return null;

  const mapping = await getOmieMapping(tenantId);
  if (!mapping?.externalClientId || mapping.status === "disabled") return null;

  const result = await getOmieGClickAdapter().clients.listResponsibles(
    mapping.externalClientId,
  );
  if (!result.ok || result.data.length === 0) return null;

  return result.data;
}
