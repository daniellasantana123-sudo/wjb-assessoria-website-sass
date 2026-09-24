"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import {
  getGClickConfig,
  getOmieGClickAdapter,
  type ExternalClient,
  type ExternalTask,
  type ProviderResult,
} from "@/integrations/omie-gclick";
import {
  describeSyncResult,
  EXTERNAL_SOURCE,
  planObligationSync,
} from "@/lib/obligations/external-sync";
import {
  documentsMatch,
  isSearchable,
  looksLikeDocument,
  MIN_SEARCH_LENGTH,
  normalizeClientSearch,
} from "@/lib/integrations/client-search";
import { omieMappingSchema } from "@/lib/validation/omie-gclick";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { notifyIntegrationStatus } from "@/lib/notifications";

export type OmieActionState =
  { error: string } | { success: string } | undefined;

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
  const status = externalClientId
    ? "connected"
    : externalPortalUrl
      ? "pending"
      : "not_connected";

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
    metadata: {
      external_client_id: externalClientId,
      external_portal_url: externalPortalUrl,
      status,
    },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  return { success: "Mapeamento salvo." };
}

/** Referência externa determinística - mesmo tenant sempre gera a mesma, sem precisar consultar nada antes. */
function externalReferenceFor(tenantId: string): string {
  return `wjb-tenant-${tenantId}`;
}

/**
 * Sincroniza o cliente do tenant com o provider ativo (`getOmieGClickAdapter()`
 * - Fase 6.5: mock funcional por padrão, real sempre bloqueado até a
 * especificação técnica da G-Click ser confirmada). Idempotente: se já
 * existe `external_client_id` salvo, atualiza; senão, cria - nunca duas
 * criações pro mesmo tenant.
 */
export async function syncOmieClient(
  tenantId: string,
): Promise<OmieActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  /**
   * Kill switch global (Fase 5) - desligar a flag bloqueia toda
   * sincronização nova, independente do status por tenant. Checado aqui
   * (não em `getOmieGClickAdapter()`) porque a leitura de mapeamento no
   * Dashboard do cliente (`getOmieMapping`) nunca chama o adapter mesmo -
   * a flag só precisa cortar o caminho de escrita.
   */
  if (!(await isFeatureEnabled("omie_gclick"))) {
    return {
      error: "A integração Omie.G-Click está desativada pela WJB no momento.",
    };
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

  await supabase
    .from("omie_client_mappings")
    .upsert(
      { tenant_id: tenantId, status: "syncing", updated_by: session.userId },
      { onConflict: "tenant_id" },
    );

  const adapter = getOmieGClickAdapter();
  const result = mapping?.external_client_id
    ? await adapter.clients.update({
        externalId: mapping.external_client_id,
        name: tenant.name,
        document: tenant.cnpj,
      })
    : await adapter.clients.create({
        internalId: tenant.id,
        externalReference: externalReferenceFor(tenant.id),
        name: tenant.name,
        document: tenant.cnpj,
      });

  await supabase.from("omie_client_mappings").upsert(
    {
      tenant_id: tenantId,
      external_client_id: result.ok
        ? result.data.externalId
        : (mapping?.external_client_id ?? null),
      status: result.ok ? "synced" : "error",
      last_synced_at: result.ok ? new Date().toISOString() : undefined,
      last_error: result.ok ? null : result.error.code,
      updated_by: session.userId,
    },
    { onConflict: "tenant_id" },
  );

  // Log sanitizado: só o código do resultado, nunca credenciais nem a resposta bruta do provider.
  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "integration.omie_sync_attempted",
    entity: "omie_client_mapping",
    entity_id: tenantId,
    metadata: {
      ok: result.ok,
      error: result.ok ? undefined : result.error.code,
    },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);

  if (!result.ok) {
    // Notificação de "status de integração" (Fase 6) - avisa o resto do time (quem clicou já viu o resultado inline).
    await notifyIntegrationStatus({
      message: `Falha ao sincronizar ${tenant.name} com o Omie.G-Click (${result.error.message}).`,
      link: `/admin/empresas/${tenantId}`,
      excludeActorId: session.userId,
    });
    return {
      error: `Falha ao sincronizar com o Omie.G-Click (${result.error.message}).`,
    };
  }

  /**
   * Nunca dizer só "Sincronizado" sem qualificar o modo (seção 37 do
   * prompt da Fase 6.5: "não apresentar como Conectado ao G-Click real")
   * - em modo mock isto NUNCA tocou a API de verdade, é uma simulação em
   * memória que nem sobrevive a um restart do servidor.
   */
  const { mode } = getGClickConfig();
  return {
    success:
      mode === "mock"
        ? "Simulado com sucesso (modo mock - nenhuma sincronização real foi feita)."
        : `Sincronizado com o Omie.G-Click (modo ${mode}).`,
  };
}

/** Desativa/reativa a integração para um tenant específico, sem apagar o mapeamento salvo. */
export async function setOmieMappingDisabled(
  tenantId: string,
  disabled: boolean,
) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) return;

  const supabase = await createClient();
  const { data: mapping } = await supabase
    .from("omie_client_mappings")
    .select("external_client_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const reactivatedStatus = mapping?.external_client_id
    ? "connected"
    : "pending";

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
    action: disabled
      ? "integration.omie_disabled"
      : "integration.omie_reactivated",
    entity: "omie_client_mapping",
    entity_id: tenantId,
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
}

/**
 * "Testar conexão" do console admin - `healthCheck()` do provider ativo
 * (mock: sempre `available`; real: sempre `not_configured`, nunca chama
 * rede - ver `src/integrations/omie-gclick/http.provider.ts`). Não
 * staff-only demais: qualquer staff pode conferir (mesma permissão de
 * leitura de `integrations.read` seria suficiente, mas mantém em
 * `integrations.manage` por consistência com as outras ações desta
 * integração).
 */
export async function testOmieConnection(): Promise<OmieActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  const health = await getOmieGClickAdapter().healthCheck();
  const ok = health.status === "available";

  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "integration.omie_connection_tested",
    entity: "omie_client_mapping",
    metadata: { ok, mode: health.mode, status: health.status },
  });

  if (!ok) {
    return {
      error:
        health.status === "not_configured"
          ? "A integração real com o Omie.G-Click ainda não está configurada - aguardando validação técnica oficial."
          : `Falha ao conectar com o Omie.G-Click (${health.status}).`,
    };
  }

  // Nunca dizer "Conectado"/"confirmada" sem qualificar - modo mock nunca testou nada real (Checkpoint 6.5.1, seção 5).
  return {
    success:
      health.mode === "mock"
        ? "Verificação simulada com sucesso (modo mock - nenhuma conexão real foi testada)."
        : `Conexão com o Omie.G-Click confirmada (modo ${health.mode}).`,
  };
}

/**
 * Traz as obrigações do tenant a partir das tarefas do Omie.G-Click
 * (2026-09-24). É a peça que faltava para o cliente ver na plataforma o
 * que a WJB já controla no G-Click, sem ninguém redigitar nada.
 *
 * Direção única, de fora para dentro. Escrever de volta no G-Click não
 * está no escopo: lá é onde a equipe trabalha, e um erro nosso viraria
 * ruído na ferramenta de produção do escritório.
 *
 * O que esta função nunca faz:
 * - tocar obrigação criada à mão (`external_id` nulo) - a autoria da WJB
 *   tem precedência sobre qualquer coisa vinda de fora;
 * - inventar vencimento para tarefa que não tem um (são contadas e
 *   reportadas como ignoradas);
 * - importar tarefa de outro cliente (filtro em `planObligationSync`).
 */
export async function syncOmieObligations(
  tenantId: string,
): Promise<OmieActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  if (!(await isFeatureEnabled("omie_gclick"))) {
    return {
      error: "A integração Omie.G-Click está desativada pela WJB no momento.",
    };
  }

  const supabase = await createClient();

  const [{ data: mapping }, { data: tenant }] = await Promise.all([
    supabase
      .from("omie_client_mappings")
      .select("external_client_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("tenants").select("cnpj").eq("id", tenantId).maybeSingle(),
  ]);

  if (!mapping?.external_client_id) {
    return {
      error:
        "Vincule primeiro o cliente no G-Click (campo \"ID do cliente\") antes de sincronizar as obrigações.",
    };
  }

  if (mapping.status === "disabled") {
    return { error: "A integração está desativada para esta empresa." };
  }

  /*
   * A API devolve as tarefas da conta inteira, paginadas - não há filtro
   * por cliente no endpoint. Percorremos as páginas e filtramos aqui.
   * O teto de páginas evita um laço infinito caso a paginação da API
   * responda de forma inesperada; ao ser atingido, a sincronização
   * termina com o que já leu, sem fingir que viu tudo.
   */
  const MAX_PAGES = 25;
  const PAGE_SIZE = 100;
  const tasks: ExternalTask[] = [];
  const adapter = getOmieGClickAdapter();
  let truncated = false;

  /*
   * **A paginação do G-Click começa em ZERO** (é Spring). Este laço
   * começava em 1 e lia a *segunda* página - que, numa conta com poucas
   * tarefas, vem vazia. O resultado era a sincronização terminar sem erro
   * nenhum dizendo que não havia tarefa alguma, enquanto a conta tinha 5.
   * Custou várias rodadas de diagnóstico porque nada falhava: a resposta
   * era um 200 legítimo, só que da página errada. Confirmado na API em
   * 2026-09-24: `page=0` devolve 5 itens, `page=1` devolve 0.
   */
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await adapter.tasks.list({ page, pageSize: PAGE_SIZE });

    if (!result.ok) {
      await supabase.from("omie_client_mappings").upsert(
        {
          tenant_id: tenantId,
          status: "error",
          last_error: result.error.code,
          updated_by: session.userId,
        },
        { onConflict: "tenant_id" },
      );
      return {
        error: `Falha ao ler as tarefas do Omie.G-Click (${result.error.message}).`,
      };
    }

    tasks.push(...result.data.items);

    if (result.data.items.length < PAGE_SIZE) break;
    // `MAX_PAGES - 1` porque o índice começa em 0: esta é a última volta.
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const plan = planObligationSync(tasks, {
    clientExternalId: mapping.external_client_id,
    document: tenant?.cnpj ?? null,
  });

  const { data: existing } = await supabase
    .from("obligations")
    .select("id, external_id, title, due_date, status")
    .eq("tenant_id", tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .not("external_id", "is", null);

  const existingByExternalId = new Map(
    (existing ?? []).map((row) => [row.external_id as string, row]),
  );

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const item of plan.upserts) {
    const current = existingByExternalId.get(item.externalId);

    if (!current) {
      const { error } = await supabase.from("obligations").insert({
        tenant_id: tenantId,
        title: item.title,
        due_date: item.dueDate,
        status: item.status,
        created_by: session.userId,
        external_id: item.externalId,
        external_source: EXTERNAL_SOURCE,
        external_synced_at: now,
      });
      if (!error) created++;
      continue;
    }

    const changed =
      current.title !== item.title ||
      current.due_date !== item.dueDate ||
      current.status !== item.status;

    // Sem mudança real, só carimba a data de conferência - assim
    // "sincronizado agora" continua verdadeiro sem inflar a contagem de
    // atualizações mostrada na tela.
    const { error } = await supabase
      .from("obligations")
      .update(
        changed
          ? {
              title: item.title,
              due_date: item.dueDate,
              status: item.status,
              external_synced_at: now,
            }
          : { external_synced_at: now },
      )
      .eq("id", current.id);

    if (!error && changed) updated++;
  }

  if (plan.removals.length > 0) {
    const { error, count } = await supabase
      .from("obligations")
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("external_source", EXTERNAL_SOURCE)
      .in("external_id", plan.removals);
    if (!error) removed = count ?? 0;
  }

  await supabase.from("omie_client_mappings").upsert(
    {
      tenant_id: tenantId,
      status: "synced",
      last_synced_at: now,
      last_error: null,
      updated_by: session.userId,
    },
    { onConflict: "tenant_id" },
  );

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "integration.omie_obligations_synced",
    entity: "obligation",
    metadata: {
      created,
      updated,
      removed,
      skipped: plan.skipped,
      examined: plan.examined,
      matched: plan.matched,
      truncated,
    },
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  revalidatePath("/portal/obrigacoes");

  const summary = describeSyncResult({
    created,
    updated,
    removed,
    skipped: plan.skipped,
    examined: plan.examined,
    matched: plan.matched,
  });
  const { mode } = getGClickConfig();

  return {
    success:
      mode === "mock"
        ? `${summary} (modo mock - as tarefas vieram de dados fictícios, não do G-Click real.)`
        : truncated
          ? `${summary} Havia mais tarefas do que o limite de leitura desta rodada - sincronize de novo para continuar.`
          : summary,
  };
}

export interface GClickClientOption {
  externalId: string;
  name: string;
  document: string | null;
}

export type OmieSearchState =
  | { error: string }
  | { results: GClickClientOption[] };

/**
 * Busca clientes no G-Click por CNPJ ou nome (2026-09-24), para o staff
 * vincular a empresa escolhendo numa lista em vez de digitar o id.
 *
 * Existe porque digitar o id à mão era o passo mais frágil do cadastro:
 * um dígito errado vincula a empresa errada, e o erro só apareceria muito
 * depois, quando as obrigações de outro cliente surgissem no portal.
 */
export async function searchGClickClients(
  text: string,
): Promise<OmieSearchState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "integrations.manage")) {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  if (!(await isFeatureEnabled("omie_gclick"))) {
    return { error: "A integração Omie.G-Click está desativada no momento." };
  }

  if (!isSearchable(text)) {
    return {
      error: `Digite pelo menos ${MIN_SEARCH_LENGTH} caracteres do CNPJ ou do nome.`,
    };
  }

  const adapter = getOmieGClickAdapter();
  const normalized = normalizeClientSearch(text);

  const result = await adapter.clients.search({
    text: normalized,
    pageSize: 20,
  });

  if (!result.ok) {
    return { error: `Não foi possível buscar no G-Click (${result.error.message}).` };
  }

  let items = result.data.items;

  /*
   * Confirmado em produção (2026-09-24, com a ARMEL X TECNOLOGIA): o
   * `/clientes/search?texto=` do G-Click procura **só pelo nome** - o
   * mesmo CNPJ que não devolvia nada apareceu ao buscar pelo nome. E o
   * nome costuma divergir entre os dois sistemas (lá "ARMEL GUEZEM
   * TITIO", aqui "ARMEL X TECNOLOGIA"), enquanto o CNPJ é o mesmo.
   *
   * Por isso, quando a busca textual de um documento vem vazia, varremos
   * a lista de clientes comparando a inscrição. É mais caro, mas só
   * acontece nesse caso específico - e é o que faz o CNPJ, que é a chave
   * confiável, funcionar de verdade.
   */
  if (items.length === 0 && looksLikeDocument(text)) {
    const byDocument = await findClientByDocument(adapter, normalized);
    if (!byDocument.ok) {
      return {
        error: `Não foi possível buscar no G-Click (${byDocument.error.message}).`,
      };
    }
    items = byDocument.data;
  }

  return {
    results: items
      // Cliente sem id não serve para vincular - só ocuparia a lista.
      .filter((client): client is typeof client & { externalId: string } =>
        Boolean(client.externalId),
      )
      .map((client) => ({
        externalId: client.externalId,
        name: client.name,
        document: client.document,
      })),
  };
}

/**
 * Procura um cliente pela inscrição varrendo a lista paginada.
 *
 * Existe porque o endpoint de busca do G-Click ignora o CNPJ (ver o
 * comentário em `searchGClickClients`). Para na primeira coincidência: um
 * CNPJ identifica uma empresa só, então continuar lendo páginas depois de
 * achar seria desperdício.
 *
 * O teto de páginas evita varrer uma carteira enorme indefinidamente -
 * ao ser atingido sem achar, devolve vazio, que a tela já apresenta como
 * "nenhum cliente encontrado".
 */
async function findClientByDocument(
  adapter: ReturnType<typeof getOmieGClickAdapter>,
  document: string,
): Promise<ProviderResult<ExternalClient[]>> {
  const MAX_PAGES = 15;
  const PAGE_SIZE = 100;
  let listFailed = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await adapter.clients.list({ page, pageSize: PAGE_SIZE });
    if (!result.ok) {
      listFailed = true;
      break;
    }

    const hit = result.data.items.find((client) =>
      documentsMatch(client.document, document),
    );
    if (hit) return { ok: true, data: [hit] };

    if (result.data.items.length < PAGE_SIZE) break;
  }

  if (!listFailed) return { ok: true, data: [] };

  /*
   * `GET /clientes` pode estar quebrado por dado inválido de UM cadastro e
   * derrubar a listagem inteira - foi o que aconteceu na conta da WJB em
   * 2026-09-24 ("Status complementar 'Em Carteria' não encontrado", um
   * status com erro de digitação que a API não resolve). Nesse caso a
   * carteira ainda responde, e ela também traz a inscrição de cada
   * cliente, então serve para o mesmo fim.
   */
  const portfolio = await adapter.catalog.portfolio();
  if (!portfolio.ok) return portfolio;

  const hit = portfolio.data.find((item) =>
    documentsMatch(item.document, document),
  );
  if (!hit) return { ok: true, data: [] };

  // A carteira traz menos campos que um cliente completo; o que importa
  // para vincular é o id, e o resto a tela não usa.
  return {
    ok: true,
    data: [
      {
        internalId: "",
        externalId: hit.clientExternalId,
        externalReference: "",
        name: hit.name,
        document: hit.document,
        status: null,
        metadata: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
  };
}
