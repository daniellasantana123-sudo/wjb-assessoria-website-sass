import "server-only";

import type { GClickConfig } from "./config";
import {
  fromExternalPayload as clientFromExternal,
  toCreatePayload,
  toUpdatePayload,
  type GClickClientPayload,
} from "./mappers/client.mapper";
import { fromExternalError, fromTransportError } from "./mappers/error.mapper";
import {
  activitiesFromExternal,
  catalogItemsFromExternal,
  personsFromExternal,
  portfolioFromExternal,
} from "./mappers/lookup.mapper";
import {
  fromExternalPayload as taskFromExternal,
  toCreatePreTaskPayload,
} from "./mappers/task.mapper";
import type {
  CreateExternalClientInput,
  CreateExternalPreTaskInput,
  ExternalCatalogItem,
  ExternalClient,
  ExternalPerson,
  ExternalPortfolioItem,
  ExternalTask,
  ExternalTaskActivity,
  ListExternalClientsInput,
  ListExternalTasksInput,
  OmieGClickAdapter,
  PaginatedResult,
  ProviderCapabilities,
  ProviderError,
  ProviderHealth,
  ProviderResult,
  SearchInput,
  SetExternalPartnersInput,
  UpdateExternalClientInput,
} from "./types";

/** Só obrigações viram prazo no Portal; solicitações são outro fluxo. */
const DEFAULT_TASK_CATEGORY = "Obrigacao" as const;

/** Quantos meses para trás a listagem de tarefas cobre por padrão. */
const TASK_WINDOW_MONTHS = 12;

/**
 * Início da janela de tarefas: 12 meses atrás, no primeiro dia do mês.
 *
 * Cobre o ano fiscal corrente e o anterior sem pedir à API a base
 * inteira. Data montada no fuso local (não `toISOString()`, que
 * converteria para UTC e devolveria o dia anterior no Brasil).
 */
function defaultActionDateFrom(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - TASK_WINDOW_MONTHS, 1);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  return `${start.getFullYear()}-${month}-01`;
}

/** Corpo esperado pelos endpoints de sócios: ids já cadastrados no G-Click. */
function toPartnerIdsPayload(input: SetExternalPartnersInput) {
  return {
    sociosIds: input.partnerIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)),
  };
}

/**
 * Provider real da Omie.G-Click.
 *
 * **Implementado em 2026-09-23**, depois que a documentação técnica
 * oficial foi obtida (coleção Postman completa, versionada em
 * `docs/integrations/gclick/postman-collection.json`). Até então isto era
 * um esqueleto que bloqueava toda chamada - ver o histórico da Fase 6.5 e
 * do Checkpoint 6.5.1.
 *
 * **A Proteção 1 continua valendo**: `GCLICK_REAL_INTEGRATION_ENABLED`
 * precisa ser exatamente "true" pra qualquer chamada de rede acontecer.
 * Sem ela, todo método resolve `PROVIDER_NOT_CONFIGURED` como antes. A
 * Proteção 2 (`REAL_PROVIDER_IMPLEMENTED`) deixou de bloquear porque a
 * condição que ela guardava - "não existe implementação real, não invente
 * uma" - deixou de ser verdade.
 */
const REAL_PROVIDER_IMPLEMENTED = true as const;

/** Exportado pra o teste do Checkpoint 6.5.1 afirmar o estado atual da Proteção 2. */
export function isRealProviderImplemented(): boolean {
  return REAL_PROVIDER_IMPLEMENTED;
}

export interface GClickHttpProviderOptions {
  /** Proteção 1 - `true` quando `GCLICK_REAL_INTEGRATION_ENABLED` != "true". Decidida no factory, nunca aqui. */
  blockedByFeatureFlag: boolean;
}

/** Renova o token um minuto antes do vencimento, pra nunca usar um já expirado em voo. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

export function createGClickHttpProvider(
  config: GClickConfig,
  options: GClickHttpProviderOptions,
): OmieGClickAdapter {
  /** Cache por instância do provider (que já é memoizada por processo no factory). */
  let token: TokenState | null = null;

  function configurationError(): ProviderError | null {
    if (options.blockedByFeatureFlag) {
      return {
        code: "PROVIDER_NOT_CONFIGURED",
        message:
          'Integração real G-Click desabilitada (GCLICK_REAL_INTEGRATION_ENABLED != "true").',
      };
    }
    if (!config.clientId || !config.clientSecret) {
      return {
        code: "PROVIDER_NOT_CONFIGURED",
        message: "GCLICK_CLIENT_ID/GCLICK_CLIENT_SECRET não configurados.",
      };
    }
    return null;
  }

  async function withTimeout(
    input: string,
    init: RequestInit,
  ): Promise<
    { ok: true; response: Response } | { ok: false; error: ProviderError }
  > {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return { ok: true, response };
    } catch (error) {
      return { ok: false, error: fromTransportError(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * `POST /oauth/token` com `grant_type=client_credentials` em
   * form-urlencoded - formato confirmado pela coleção oficial. A resposta
   * traz `access_token` e `expires_in` (~24h); não há refresh token, a
   * renovação é repetir esta mesma chamada.
   */
  async function getAccessToken(
    force = false,
  ): Promise<
    { ok: true; token: string } | { ok: false; error: ProviderError }
  > {
    if (!force && token && token.expiresAt > Date.now()) {
      return { ok: true, token: token.accessToken };
    }

    const body = new URLSearchParams({
      client_id: config.clientId ?? "",
      client_secret: config.clientSecret ?? "",
      grant_type: "client_credentials",
    });

    const attempt = await withTimeout(`${config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!attempt.ok) return attempt;

    const { response } = attempt;
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, error: fromExternalError(response.status, payload) };
    }

    const raw = (payload ?? {}) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof raw.access_token !== "string" || raw.access_token.length === 0) {
      return {
        ok: false,
        error: {
          code: "AUTHENTICATION_ERROR",
          message: "O G-Click não devolveu um access_token válido.",
        },
      };
    }

    const expiresInSeconds =
      typeof raw.expires_in === "number" ? raw.expires_in : 0;
    token = {
      accessToken: raw.access_token,
      expiresAt:
        Date.now() +
        Math.max(expiresInSeconds * 1000 - TOKEN_SAFETY_MARGIN_MS, 0),
    };
    return { ok: true, token: token.accessToken };
  }

  /**
   * Toda chamada autenticada passa por aqui. Em 401, descarta o token em
   * cache e tenta uma única vez com um token novo - cobre o caso do token
   * ter sido revogado antes do vencimento previsto, sem virar laço.
   */
  async function request<T>(
    path: string,
    init: RequestInit = {},
    retriedAfter401 = false,
  ): Promise<ProviderResult<T>> {
    const configError = configurationError();
    if (configError) return { ok: false, error: configError };

    const auth = await getAccessToken(retriedAfter401);
    if (!auth.ok) return { ok: false, error: auth.error };

    const attempt = await withTimeout(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!attempt.ok) return { ok: false, error: attempt.error };

    const { response } = attempt;

    if (response.status === 401 && !retriedAfter401) {
      token = null;
      return request<T>(path, init, true);
    }

    if (response.status === 204) return { ok: true, data: undefined as T };

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      return {
        ok: false,
        error: fromExternalError(
          response.status,
          payload,
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : undefined,
        ),
      };
    }

    return { ok: true, data: payload as T };
  }

  /** Formato paginado do Spring, confirmado nas respostas de exemplo da coleção. */
  interface SpringPage<T> {
    content?: T[];
    number?: number;
    size?: number;
    totalElements?: number;
  }

  function toPaginated<TRaw, TOut>(
    payload: SpringPage<TRaw> | TRaw[] | null,
    map: (raw: TRaw) => TOut,
    fallbackPage: number,
    fallbackSize: number,
  ): PaginatedResult<TOut> {
    // A API às vezes devolve um array puro (ex.: `GET /clientes` sem
    // paginação explícita) e às vezes o envelope paginado.
    if (Array.isArray(payload)) {
      return {
        items: payload.map(map),
        page: fallbackPage,
        pageSize: fallbackSize,
        total: payload.length,
      };
    }
    const content = payload?.content ?? [];
    return {
      items: content.map(map),
      page: payload?.number ?? fallbackPage,
      pageSize: payload?.size ?? fallbackSize,
      total: payload?.totalElements ?? content.length,
    };
  }

  const CAPABILITIES: ProviderCapabilities = {
    canCreateClients: config.account.visibilidadeIds.length > 0,
    canUpdateClients: true,
    canFindClients: true,
    canListClients: true,
    canListTasks: true,
    canCreatePreTasks: config.account.departamentoId !== null,
    // partner_only - documentado oficialmente, nunca liberar sem autorização comercial da Omie.
    canReplyActivity: false,
    canCreatePreTaskWithTag: false,
  };

  return {
    async healthCheck(): Promise<ProviderHealth> {
      if (configurationError()) {
        return {
          provider: "gclick",
          mode: config.mode,
          status: "not_configured",
        };
      }
      const auth = await getAccessToken();
      return {
        provider: "gclick",
        mode: config.mode,
        status: auth.ok ? "available" : "unavailable",
      };
    },

    getCapabilities(): ProviderCapabilities {
      return CAPABILITIES;
    },

    clients: {
      async create(
        input: CreateExternalClientInput,
      ): Promise<ProviderResult<ExternalClient>> {
        // Ordem importa: Proteção 1 (flag) e credenciais vêm antes da
        // configuração de conta - quem está com a integração desligada
        // precisa ouvir isso, não um aviso sobre visibilidadeIds.
        const configError = configurationError();
        if (configError) return { ok: false, error: configError };

        if (config.account.visibilidadeIds.length === 0) {
          return {
            ok: false,
            error: {
              code: "PROVIDER_NOT_CONFIGURED",
              message:
                "GCLICK_VISIBILIDADE_IDS não configurado - a API exige visibilidadeIds para criar cliente.",
            },
          };
        }

        const payload = toCreatePayload(input, config);
        if (!payload) {
          return {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message:
                "CNPJ/CPF ausente ou inválido - o G-Click exige inscrição para cadastrar cliente.",
            },
          };
        }

        const result = await request<unknown>("/clientes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result.ok) return result;
        return {
          ok: true,
          data: clientFromExternal(result.data, input.internalId),
        };
      },

      async update(
        input: UpdateExternalClientInput,
      ): Promise<ProviderResult<ExternalClient>> {
        // `PUT /clientes/{id}` substitui o cadastro inteiro, então é preciso
        // ler o atual antes pra não zerar campo por omissão.
        const current = await request<GClickClientPayload>(
          `/clientes/${encodeURIComponent(input.externalId)}`,
        );
        if (!current.ok) return current;

        const payload = toUpdatePayload(input, current.data);
        const result = await request<unknown>(
          `/clientes/${encodeURIComponent(input.externalId)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );
        if (!result.ok) return result;
        return { ok: true, data: clientFromExternal(result.data) };
      },

      async findById(
        externalId: string,
      ): Promise<ProviderResult<ExternalClient | null>> {
        const result = await request<unknown>(
          `/clientes/${encodeURIComponent(externalId)}`,
        );
        // "Não existe" é resposta válida da consulta, não erro de integração.
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: null }
            : result;
        }
        return { ok: true, data: clientFromExternal(result.data) };
      },

      async findByExternalReference(
        reference: string,
      ): Promise<ProviderResult<ExternalClient | null>> {
        const result = await request<
          SpringPage<Record<string, unknown>> | Record<string, unknown>[]
        >(`/clientes/search?texto=${encodeURIComponent(reference)}`);
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: null }
            : result;
        }

        const page = toPaginated(result.data, (raw) => raw, 0, 0);
        // A busca é textual e pode trazer vizinhos; só vale como match o
        // registro cujo `integracao` bate exatamente com a referência.
        const exact = page.items.find((raw) => raw.integracao === reference);
        return { ok: true, data: exact ? clientFromExternal(exact) : null };
      },

      async list(
        input: ListExternalClientsInput = {},
      ): Promise<ProviderResult<PaginatedResult<ExternalClient>>> {
        const page = input.page ?? 0;
        const size = input.pageSize ?? 20;
        const result = await request<
          SpringPage<Record<string, unknown>> | Record<string, unknown>[]
        >(`/clientes?page=${page}&size=${size}`);
        if (!result.ok) return result;
        return {
          ok: true,
          data: toPaginated(
            result.data,
            (raw) => clientFromExternal(raw),
            page,
            size,
          ),
        };
      },

      async search(
        input: SearchInput,
      ): Promise<ProviderResult<PaginatedResult<ExternalClient>>> {
        const page = input.page ?? 0;
        const size = input.pageSize ?? 20;
        const result = await request<
          SpringPage<Record<string, unknown>> | Record<string, unknown>[]
        >(
          `/clientes/search?texto=${encodeURIComponent(input.text)}&page=${page}&size=${size}`,
        );
        // Busca sem resultado é lista vazia, não erro - quem pesquisa um
        // CNPJ que ainda não está no G-Click precisa ouvir "não achei",
        // não "falhou".
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: { items: [], page, pageSize: size, total: 0 } }
            : result;
        }
        return {
          ok: true,
          data: toPaginated(
            result.data,
            (raw) => clientFromExternal(raw),
            page,
            size,
          ),
        };
      },

      async listResponsibles(
        clientExternalId: string,
      ): Promise<ProviderResult<ExternalPerson[]>> {
        const result = await request<unknown>(
          `/clientes/${encodeURIComponent(clientExternalId)}/responsaveis`,
        );
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: [] }
            : result;
        }
        return { ok: true, data: personsFromExternal(result.data) };
      },

      async setPartners(
        input: SetExternalPartnersInput,
      ): Promise<ProviderResult<void>> {
        const configError = configurationError();
        if (configError) return { ok: false, error: configError };

        const result = await request<unknown>(
          `/clientes/${encodeURIComponent(input.clientExternalId)}/socios`,
          { method: "PUT", body: JSON.stringify(toPartnerIdsPayload(input)) },
        );
        if (!result.ok) return result;
        return { ok: true, data: undefined };
      },

      async removePartners(
        input: SetExternalPartnersInput,
      ): Promise<ProviderResult<void>> {
        const configError = configurationError();
        if (configError) return { ok: false, error: configError };

        // DELETE com corpo: a API espera os ids a desvincular, não apaga
        // todos por omissão - confirmado no exemplo da coleção oficial.
        const result = await request<unknown>(
          `/clientes/${encodeURIComponent(input.clientExternalId)}/socios`,
          {
            method: "DELETE",
            body: JSON.stringify(toPartnerIdsPayload(input)),
          },
        );
        if (!result.ok) return result;
        return { ok: true, data: undefined };
      },
    },

    tasks: {
      async list(
        input: ListExternalTasksInput = {},
      ): Promise<ProviderResult<PaginatedResult<ExternalTask>>> {
        const page = input.page ?? 0;
        const size = input.pageSize ?? 20;
        /*
         * `categoria` e `dataAcaoInicio` são obrigatórios na prática:
         * sem eles a API responde **HTTP 500**, não um erro de validação
         * - descoberto em produção em 2026-09-24, quando a primeira
         * sincronização real falhou com "Internal Server Error". O
         * exemplo da coleção oficial já trazia os dois
         * (`?categoria=Obrigacao&dataAcaoInicio=2026-02-01`); a
         * implementação inicial os ignorou por assumir que fossem
         * filtros opcionais.
         */
        const category = input.category ?? DEFAULT_TASK_CATEGORY;
        const from = input.actionDateFrom ?? defaultActionDateFrom();
        const result = await request<
          SpringPage<Record<string, unknown>> | Record<string, unknown>[]
        >(
          `/tarefas?categoria=${encodeURIComponent(category)}&dataAcaoInicio=${from}&page=${page}&size=${size}`,
        );
        if (!result.ok) return result;
        return {
          ok: true,
          data: toPaginated(
            result.data,
            (raw) => taskFromExternal(raw),
            page,
            size,
          ),
        };
      },

      async createPreTask(
        input: CreateExternalPreTaskInput,
      ): Promise<ProviderResult<ExternalTask>> {
        const configError = configurationError();
        if (configError) return { ok: false, error: configError };

        const payload = toCreatePreTaskPayload(input, config);
        if (!payload) {
          return {
            ok: false,
            error: {
              code: "PROVIDER_NOT_CONFIGURED",
              message:
                "GCLICK_DEPARTAMENTO_ID não configurado - a API exige departamentoId para criar pré-tarefa.",
            },
          };
        }

        const result = await request<unknown>("/v2/tarefas/preTarefas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result.ok) return result;
        return { ok: true, data: taskFromExternal(result.data) };
      },

      async listResponsibles(
        taskId: string,
      ): Promise<ProviderResult<ExternalPerson[]>> {
        const result = await request<unknown>(
          `/tarefas/${encodeURIComponent(taskId)}/responsaveis`,
        );
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: [] }
            : result;
        }
        return { ok: true, data: personsFromExternal(result.data) };
      },

      async listGuests(
        taskId: string,
      ): Promise<ProviderResult<ExternalPerson[]>> {
        const result = await request<unknown>(
          `/tarefas/${encodeURIComponent(taskId)}/convidados`,
        );
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: [] }
            : result;
        }
        return { ok: true, data: personsFromExternal(result.data) };
      },

      async listActivities(
        taskId: string,
      ): Promise<ProviderResult<ExternalTaskActivity[]>> {
        const result = await request<unknown>(
          `/tarefas/${encodeURIComponent(taskId)}/atividades`,
        );
        if (!result.ok) {
          return result.error.code === "NOT_FOUND"
            ? { ok: true, data: [] }
            : result;
        }
        return { ok: true, data: activitiesFromExternal(result.data) };
      },
    },

    catalog: {
      async groups(
        search?: string,
      ): Promise<ProviderResult<ExternalCatalogItem[]>> {
        // `termo` aqui, `texto` na busca de clientes - os dois endpoints
        // usam nomes diferentes de propósito na API, não é engano.
        const path = search
          ? `/grupos/busca?termo=${encodeURIComponent(search)}`
          : "/grupos?page=0&size=100";
        const result = await request<unknown>(path);
        if (!result.ok) return result;
        return { ok: true, data: catalogItemsFromExternal(result.data) };
      },

      async visibilities(
        search?: string,
      ): Promise<ProviderResult<ExternalCatalogItem[]>> {
        const path = search
          ? `/visibilidades/busca?termo=${encodeURIComponent(search)}`
          : "/visibilidades?page=0&size=100";
        const result = await request<unknown>(path);
        if (!result.ok) return result;
        return { ok: true, data: catalogItemsFromExternal(result.data) };
      },

      async flows(): Promise<ProviderResult<ExternalCatalogItem[]>> {
        const result = await request<unknown>("/fluxos");
        if (!result.ok) return result;
        return { ok: true, data: catalogItemsFromExternal(result.data) };
      },

      async portfolio(): Promise<ProviderResult<ExternalPortfolioItem[]>> {
        const result = await request<unknown>("/carteira?page=0&size=200");
        if (!result.ok) return result;
        return { ok: true, data: portfolioFromExternal(result.data) };
      },
    },
  };
}
