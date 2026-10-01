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
  clientMatches,
  documentsMatch,
  formatDocument,
  isSearchable,
  MIN_SEARCH_LENGTH,
} from "@/lib/integrations/client-search";
import { omieMappingSchema } from "@/lib/validation/omie-gclick";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { loadAllGClickClients } from "@/lib/integrations/gclick-clients";
import { notifyIntegrationStatus, notifyObligationEvent } from "@/lib/notifications";

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

async function verifyLinkedClient(
  adapter: ReturnType<typeof getOmieGClickAdapter>,
  externalId: string,
): Promise<ProviderResult<ExternalClient>> {
  const found = await adapter.clients.findById(externalId);
  if (!found.ok) return found;
  if (!found.data) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `o cliente ${externalId} não existe mais no G-Click; selecione o cadastro certo`,
      },
    };
  }
  return { ok: true, data: { ...found.data, externalId } };
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

  /*
   * Antes de CRIAR, confere se o CNPJ já existe no G-Click (2026-09-30).
   * A maioria dos clientes da WJB já está cadastrada lá: sem esta checagem,
   * clicar em "Sincronizar cadastro" antes de vincular criava um cliente
   * duplicado na ferramenta de produção do escritório. Achou: só vincula,
   * sem sobrescrever o cadastro deles. Não conseguiu conferir: não cria.
   */
  if (!mapping?.external_client_id && tenant.cnpj) {
    const existing = await findClientByDocument(adapter, tenant.cnpj);
    if (!existing.ok) {
      await supabase
        .from("omie_client_mappings")
        .upsert(
          { tenant_id: tenantId, status: "error", last_error: existing.error.code, updated_by: session.userId },
          { onConflict: "tenant_id" },
        );
      revalidatePath(`/admin/empresas/${tenantId}`);
      return {
        error:
          "Não foi possível conferir se esta empresa já existe no G-Click, então nada foi criado para evitar cadastro duplicado. Tente de novo em instantes.",
      };
    }

    const found = existing.data[0];
    if (found?.externalId) {
      await supabase.from("omie_client_mappings").upsert(
        {
          tenant_id: tenantId,
          external_client_id: found.externalId,
          status: "synced",
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_by: session.userId,
        },
        { onConflict: "tenant_id" },
      );
      await supabase.from("audit_log").insert({
        actor_id: session.userId,
        tenant_id: tenantId,
        action: "integration.omie_linked_existing",
        entity: "omie_client_mapping",
        entity_id: tenantId,
        metadata: { external_client_id: found.externalId },
      });
      revalidatePath(`/admin/empresas/${tenantId}`);
      return {
        success: `Esta empresa já existia no G-Click ("${found.name}", id ${found.externalId}). Vinculamos ao cadastro existente em vez de criar outro.`,
      };
    }
  }

  /*
   * Empresa já vinculada: só CONFERE que o cliente ainda existe no G-Click,
   * sem escrever nada lá (2026-10-01). Antes este caminho chamava
   * `clients.update` e sobrescrevia a razão social e o nome fantasia do
   * G-Click com o nome da plataforma - e o G-Click é a fonte da verdade do
   * cadastro (é onde a equipe trabalha), além de o nome fantasia ser como a
   * equipe reconhece o cliente. Corrigir cadastro, agora, só no G-Click.
   */
  const result = mapping?.external_client_id
    ? await verifyLinkedClient(adapter, mapping.external_client_id)
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
  // Só a TRANSIÇÃO pendente -> concluída avisa o cliente. Tarefas que já
  // chegam concluídas na primeira sincronização são histórico, não notícia.
  const completedNow: { id: string; title: string; dueDate: string }[] = [];

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
    if (!error && current.status !== "done" && item.status === "done") {
      completedNow.push({ id: current.id, title: item.title, dueDate: item.dueDate });
    }
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

  await notifyObligationEvent({
    tenantId,
    actorId: session.userId,
    kind: "completed",
    obligations: completedNow,
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
  tradeName: string | null;
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

  /*
   * A busca da própria API (`/clientes/search`) só olha a razão social:
   * ignora o CNPJ (confirmado em produção em 2026-09-24) e o nome fantasia
   * (2026-10-01: "pimpolha" não achava o cliente que a equipe conhece por
   * esse nome). Por isso a plataforma lê a lista completa de clientes e
   * filtra aqui por razão social, nome fantasia e CNPJ, sem diferenciar
   * maiúscula nem acento (`clientMatches`).
   */
  const all = await loadAllGClickClients(adapter);
  if (!all.ok) {
    return { error: `Não foi possível buscar no G-Click (${all.error.message}).` };
  }

  const results = all.data
    // Cliente sem id não serve para vincular - só ocuparia a lista.
    .filter((client): client is typeof client & { externalId: string } =>
      Boolean(client.externalId) && clientMatches(client, text),
    )
    .slice(0, 30)
    .map((client) => ({
      externalId: client.externalId,
      name: client.name,
      tradeName: client.tradeName && client.tradeName !== client.name ? client.tradeName : null,
      document: client.document,
    }));

  return { results };
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
  const all = await loadAllGClickClients(adapter);
  if (!all.ok) return all;
  const hit = all.data.find((client) => documentsMatch(client.document, document));
  return { ok: true, data: hit ? [hit] : [] };
}

export type ImportGClickState =
  | { error: string }
  | { success: string; imported: number; linked: number; skipped: number };

const MAX_IMPORT_PER_REQUEST = 300;


/**
 * Importa clientes do G-Click para a plataforma (2026-10-01): a carteira
 * inteira já está no G-Click, e cadastrar empresa por empresa à mão não
 * escala.
 *
 * Para cada id escolhido, relendo os dados do G-Click no servidor (nunca
 * confiando em nome/CNPJ vindos do navegador):
 * - já vinculado a uma empresa da plataforma: pula;
 * - mesmo CNPJ de uma empresa já cadastrada sem vínculo: só vincula, sem
 *   criar empresa duplicada;
 * - senão: cria a empresa (nome fantasia, ou razão social se não houver) e
 *   já salva o vínculo.
 * Nada é escrito no G-Click. As obrigações não são trazidas aqui - cada
 * sincronização lê as tarefas da conta inteira, e fazer isso por empresa
 * numa importação em massa estouraria o tempo da requisição.
 */
export async function importGClickClients(externalIds: string[]): Promise<ImportGClickState> {
  const session = await requireStaffSession();
  if (
    !hasPermission(session, "organizations.manage") ||
    !hasPermission(session, "integrations.manage")
  ) {
    return { error: "Seu papel não permite importar empresas do G-Click." };
  }
  if (!(await isFeatureEnabled("omie_gclick"))) {
    return { error: "A integração Omie.G-Click está desativada pela WJB no momento." };
  }

  const ids = [...new Set(externalIds.map(String))].slice(0, MAX_IMPORT_PER_REQUEST);
  if (ids.length === 0) return { error: "Selecione pelo menos um cliente." };

  const all = await loadAllGClickClients(getOmieGClickAdapter(), { fresh: true });
  if (!all.ok) {
    return { error: `Não foi possível ler os clientes do G-Click (${all.error.message}).` };
  }
  const byId = new Map(all.data.filter((c) => c.externalId).map((c) => [c.externalId as string, c]));

  const supabase = await createClient();
  const [{ data: tenants }, { data: mappings }] = await Promise.all([
    supabase.from("tenants").select("id, cnpj"),
    supabase.from("omie_client_mappings").select("tenant_id, external_client_id"),
  ]);
  const linkedIds = new Set((mappings ?? []).map((m) => m.external_client_id).filter(Boolean));
  const mappedTenants = new Set((mappings ?? []).filter((m) => m.external_client_id).map((m) => m.tenant_id));

  let imported = 0;
  let linked = 0;
  let skipped = 0;

  for (const id of ids) {
    const client = byId.get(id);
    if (!client || linkedIds.has(id)) {
      skipped++;
      continue;
    }

    const sameDocument = (tenants ?? []).find(
      (t) => !mappedTenants.has(t.id) && documentsMatch(t.cnpj, client.document),
    );

    let tenantId = sameDocument?.id;
    if (!tenantId) {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .insert({
          name: (client.tradeName || client.name || `Cliente G-Click ${id}`).trim(),
          cnpj: formatDocument(client.document),
          created_by: session.userId,
        })
        .select("id")
        .single();
      if (error || !tenant) {
        console.error("[gclick-import] falha ao criar empresa:", error);
        skipped++;
        continue;
      }
      tenantId = tenant.id;
    }

    const { error: mappingError } = await supabase.from("omie_client_mappings").upsert(
      {
        tenant_id: tenantId,
        external_client_id: id,
        status: "connected",
        last_error: null,
        updated_by: session.userId,
      },
      { onConflict: "tenant_id" },
    );
    if (mappingError) {
      console.error("[gclick-import] falha ao vincular:", mappingError);
      skipped++;
      continue;
    }

    linkedIds.add(id);
    mappedTenants.add(tenantId);
    if (sameDocument) linked++;
    else imported++;

    await supabase.from("audit_log").insert({
      actor_id: session.userId,
      tenant_id: tenantId,
      action: "tenant.imported_from_gclick",
      entity: "tenant",
      entity_id: tenantId,
      metadata: { external_client_id: id, linked_existing: Boolean(sameDocument) },
    });
  }

  revalidatePath("/admin/empresas");
  revalidatePath("/admin/empresas/importar");

  const parts = [
    imported ? `${imported} empresa(s) criada(s) na plataforma` : null,
    linked ? `${linked} vinculada(s) a empresas que já existiam com o mesmo CNPJ` : null,
    skipped ? `${skipped} ignorada(s) (já importadas ou não encontradas)` : null,
  ].filter(Boolean);

  return {
    success: parts.length ? `${parts.join(", ")}.` : "Nada a importar.",
    imported,
    linked,
    skipped,
  };
}

export type GClickTaskState = { error: string } | { success: string } | undefined;

/**
 * Cria uma tarefa (pré-tarefa) no G-Click para a equipe, a partir da ficha
 * da empresa (2026-10-01, decisão do usuário: as tarefas vivem no G-Click,
 * a plataforma só facilita a criação). A API não aceita prazo na
 * pré-tarefa: a equipe completa no G-Click.
 *
 * O cliente vem do vínculo salvo (nunca do formulário), o departamento
 * precisa estar na lista configurada (`GCLICK_DEPARTAMENTOS`) e o
 * responsável, se escolhido, precisa ser um dos responsáveis do cliente no
 * G-Click - assim um valor adulterado no formulário não cria tarefa em
 * departamento ou pessoa aleatória.
 */
export async function createGClickTask(
  tenantId: string,
  _prev: GClickTaskState,
  formData: FormData,
): Promise<GClickTaskState> {
  const session = await requireStaffSession();
  if (!hasPermission(session, "tasks.create")) {
    return { error: "Seu papel não permite criar tarefas." };
  }
  if (!(await isFeatureEnabled("omie_gclick"))) {
    return { error: "A integração Omie.G-Click está desativada pela WJB no momento." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const departmentId = Number(formData.get("departmentId"));
  const responsibleId = String(formData.get("responsibleId") ?? "").trim();

  if (title.length < 3) return { error: "Informe um assunto para a tarefa." };
  if (title.length > 200) return { error: "O assunto pode ter até 200 caracteres." };
  if (description.length > 4000) return { error: "A descrição pode ter até 4.000 caracteres." };

  const { account } = getGClickConfig();
  if (!account.departments.some((d) => d.id === departmentId)) {
    return { error: "Escolha um departamento da lista." };
  }

  const supabase = await createClient();
  const [{ data: tenant }, { data: mapping }] = await Promise.all([
    supabase.from("tenants").select("id, name, cnpj").eq("id", tenantId).maybeSingle(),
    supabase
      .from("omie_client_mappings")
      .select("external_client_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  if (!tenant) return { error: "Empresa não encontrada." };
  if (!mapping?.external_client_id) {
    return { error: "Vincule a empresa ao G-Click antes de criar tarefas." };
  }
  if (mapping.status === "disabled") {
    return { error: "A integração está desativada para esta empresa." };
  }

  const adapter = getOmieGClickAdapter();

  if (responsibleId) {
    const responsibles = await adapter.clients.listResponsibles(mapping.external_client_id);
    if (!responsibles.ok || !responsibles.data.some((p) => p.externalId === responsibleId)) {
      return { error: "Escolha um responsável da lista." };
    }
  }

  const result = await adapter.tasks.createPreTask({
    clientExternalId: mapping.external_client_id,
    title,
    description: description || undefined,
    departmentId,
    responsibleId: responsibleId || undefined,
    documents: tenant.cnpj ? [tenant.cnpj] : undefined,
  });

  if (!result.ok) {
    return { error: `Não foi possível criar a tarefa no G-Click (${result.error.message}).` };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "integration.gclick_task_created",
    entity: "gclick_task",
    entity_id: result.data.externalId,
    metadata: { title, department_id: departmentId, responsible_id: responsibleId || null },
  });

  return {
    success: `Tarefa "${title}" criada no G-Click${result.data.externalId ? ` (id ${result.data.externalId})` : ""}. Defina o prazo e acompanhe por lá.`,
  };
}
