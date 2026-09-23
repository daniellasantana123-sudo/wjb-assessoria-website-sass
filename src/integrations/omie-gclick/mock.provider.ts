import "server-only";

import { MOCK_CLIENT_EXISTING, MOCK_TASK_FIXTURES } from "./fixtures";
import type {
  CreateExternalClientInput,
  CreateExternalPreTaskInput,
  ExternalClient,
  ExternalTask,
  ListExternalClientsInput,
  ListExternalTasksInput,
  OmieGClickAdapter,
  PaginatedResult,
  ProviderCapabilities,
  ProviderError,
  ProviderHealth,
  ProviderResult,
  UpdateExternalClientInput,
} from "./types";

/**
 * Cenários simuláveis (seção 8 do prompt da Fase 6.5) - determinísticos
 * (seção 9): nenhum comportamento aleatório, o cenário ativo decide o
 * resultado de toda chamada até ser trocado de novo.
 */
export type MockScenario =
  | "SUCCESS"
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export interface MockGClickProvider extends OmieGClickAdapter {
  /** Muda o comportamento de TODA chamada seguinte, até ser trocado de novo. */
  setScenario(scenario: MockScenario): void;
  /** Restaura ao estado inicial (1 cliente fixture pré-cadastrado, cenário SUCCESS) - uso em testes. */
  reset(): void;
}

const CAPABILITIES: ProviderCapabilities = {
  canCreateClients: true,
  canUpdateClients: true,
  canFindClients: true,
  canListClients: true,
  canListTasks: true,
  canCreatePreTasks: true,
  // partner_only mesmo no mock - nunca simular como liberado, pra não acostumar quem testa com uma capacidade que não existe de verdade.
  canReplyActivity: false,
  canCreatePreTaskWithTag: false,
};

function scenarioToError(scenario: MockScenario): ProviderError | null {
  switch (scenario) {
    case "AUTH_ERROR":
      return {
        code: "AUTHENTICATION_ERROR",
        message: "Mock: autenticação inválida simulada.",
      };
    case "RATE_LIMIT":
      return {
        code: "RATE_LIMITED",
        message: "Mock: limite de requisições simulado.",
        retryAfterMs: 1000,
      };
    case "TIMEOUT":
      return { code: "TIMEOUT", message: "Mock: tempo limite simulado." };
    case "UNAVAILABLE":
      return {
        code: "UNAVAILABLE",
        message: "Mock: provider indisponível simulado.",
      };
    case "VALIDATION_ERROR":
      return {
        code: "VALIDATION_ERROR",
        message: "Mock: dados inválidos simulados.",
      };
    case "UNKNOWN_ERROR":
      return {
        code: "UNKNOWN_PROVIDER_ERROR",
        message: "Mock: erro não classificado simulado.",
      };
    case "SUCCESS":
      return null;
  }
}

/**
 * Provider funcional em memória - implementa o mesmo contrato
 * (`OmieGClickAdapter`) que `GClickHttpProvider` implementará de verdade
 * no futuro (seção 7 do prompt). Cada instância parte com 1 cliente
 * fixture (`MOCK_CLIENT_EXISTING`) já cadastrado, pra exercitar os
 * fluxos de "atualizar"/"já existe" sem precisar criar primeiro.
 */
export function createMockGClickProvider(): MockGClickProvider {
  let scenario: MockScenario = "SUCCESS";
  let nextId = 9002;
  let clientsByExternalId = new Map<string, ExternalClient>();
  let clientsByReference = new Map<string, ExternalClient>();

  function seed() {
    clientsByExternalId = new Map([
      [MOCK_CLIENT_EXISTING.externalId as string, MOCK_CLIENT_EXISTING],
    ]);
    clientsByReference = new Map([
      [MOCK_CLIENT_EXISTING.externalReference, MOCK_CLIENT_EXISTING],
    ]);
  }
  seed();

  function fail<T>(): ProviderResult<T> | null {
    const error = scenarioToError(scenario);
    return error ? { ok: false, error } : null;
  }

  return {
    async healthCheck(): Promise<ProviderHealth> {
      return { provider: "gclick", mode: "mock", status: "available" };
    },

    getCapabilities(): ProviderCapabilities {
      return CAPABILITIES;
    },

    clients: {
      async create(
        input: CreateExternalClientInput,
      ): Promise<ProviderResult<ExternalClient>> {
        const early = fail<ExternalClient>();
        if (early) return early;

        if (clientsByReference.has(input.externalReference)) {
          return {
            ok: false,
            error: {
              code: "DUPLICATE",
              message:
                "Mock: já existe um cliente com essa referência externa.",
            },
          };
        }

        const now = new Date().toISOString();
        const client: ExternalClient = {
          internalId: input.internalId,
          externalId: String(nextId++),
          externalReference: input.externalReference,
          name: input.name,
          document: input.document,
          status: "active",
          metadata: null,
          createdAt: now,
          updatedAt: now,
        };
        clientsByExternalId.set(client.externalId as string, client);
        clientsByReference.set(client.externalReference, client);
        return { ok: true, data: client };
      },

      async update(
        input: UpdateExternalClientInput,
      ): Promise<ProviderResult<ExternalClient>> {
        const early = fail<ExternalClient>();
        if (early) return early;

        const existing = clientsByExternalId.get(input.externalId);
        if (!existing) {
          return {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "Mock: cliente não encontrado.",
            },
          };
        }

        const updated: ExternalClient = {
          ...existing,
          name: input.name ?? existing.name,
          document:
            input.document !== undefined ? input.document : existing.document,
          updatedAt: new Date().toISOString(),
        };
        clientsByExternalId.set(updated.externalId as string, updated);
        clientsByReference.set(updated.externalReference, updated);
        return { ok: true, data: updated };
      },

      async findById(
        externalId: string,
      ): Promise<ProviderResult<ExternalClient | null>> {
        const early = fail<ExternalClient | null>();
        if (early) return early;
        return { ok: true, data: clientsByExternalId.get(externalId) ?? null };
      },

      async findByExternalReference(
        reference: string,
      ): Promise<ProviderResult<ExternalClient | null>> {
        const early = fail<ExternalClient | null>();
        if (early) return early;
        return { ok: true, data: clientsByReference.get(reference) ?? null };
      },

      async list(
        input?: ListExternalClientsInput,
      ): Promise<ProviderResult<PaginatedResult<ExternalClient>>> {
        const early = fail<PaginatedResult<ExternalClient>>();
        if (early) return early;

        const items = Array.from(clientsByExternalId.values());
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        const start = (page - 1) * pageSize;
        return {
          ok: true,
          data: {
            items: items.slice(start, start + pageSize),
            page,
            pageSize,
            total: items.length,
          },
        };
      },
    },

    tasks: {
      async list(
        input?: ListExternalTasksInput,
      ): Promise<ProviderResult<PaginatedResult<ExternalTask>>> {
        const early = fail<PaginatedResult<ExternalTask>>();
        if (early) return early;

        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        const start = (page - 1) * pageSize;
        return {
          ok: true,
          data: {
            items: MOCK_TASK_FIXTURES.slice(start, start + pageSize),
            page,
            pageSize,
            total: MOCK_TASK_FIXTURES.length,
          },
        };
      },

      async createPreTask(
        input: CreateExternalPreTaskInput,
      ): Promise<ProviderResult<ExternalTask>> {
        const early = fail<ExternalTask>();
        if (early) return early;

        const task: ExternalTask = {
          externalId: `task-mock-${nextId++}`,
          clientExternalId: input.clientExternalId,
          title: input.title,
          status: "open",
          dueDate: null,
        };
        return { ok: true, data: task };
      },
    },

    setScenario(next: MockScenario) {
      scenario = next;
    },

    reset() {
      scenario = "SUCCESS";
      nextId = 9002;
      seed();
    },
  };
}
