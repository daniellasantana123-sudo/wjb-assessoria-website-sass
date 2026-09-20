import "server-only";

import type { GClickConfig } from "./config";
import type {
  ExternalClient,
  ExternalTask,
  OmieGClickAdapter,
  PaginatedResult,
  ProviderCapabilities,
  ProviderHealth,
  ProviderResult,
} from "./types";

/**
 * Esqueleto do provider real (seção 9 do prompt da Fase 6.5) - implementa
 * o contrato, mas NENHUM método faz uma chamada HTTP de verdade. Cada um
 * resolve `PROVIDER_NOT_CONFIGURED` de forma síncrona e sanitizada.
 *
 * Isto existe pra: (1) confirmar que o contrato `OmieGClickAdapter` é
 * implementável por um provider real sem mudar a interface, e (2) marcar
 * exatamente onde a implementação real entra quando a documentação
 * técnica (Postman) e/ou credenciais forem confirmadas - ver
 * `docs/integrations/gclick/PENDING_VALIDATION.md`.
 *
 * `GClickClientMapper`/`GClickTaskMapper`/`GClickErrorMapper`
 * (`./mappers/`) é onde a tradução `ExternalClient` <-> payload real da
 * G-Click vai entrar - hoje só existem como esqueleto, nunca chamados
 * daqui, porque não há nenhuma chamada de rede que produza algo pra
 * mapear ainda.
 */
function blocked<T>(): ProviderResult<T> {
  return {
    ok: false,
    error: {
      code: "PROVIDER_NOT_CONFIGURED",
      message:
        "Integração real G-Click desabilitada até validação técnica oficial (TODO_GCLICK_VALIDATION).",
    },
  };
}

const REAL_CAPABILITIES: ProviderCapabilities = {
  // "unknown" na prática - nenhuma capacidade real foi confirmada, então tudo começa false, nunca true por suposição.
  canCreateClients: false,
  canUpdateClients: false,
  canFindClients: false,
  canListClients: false,
  canListTasks: false,
  canCreatePreTasks: false,
  canReplyActivity: false,
  canCreatePreTaskWithTag: false,
};

export function createGClickHttpProvider(config: GClickConfig): OmieGClickAdapter {
  return {
    async healthCheck(): Promise<ProviderHealth> {
      return { provider: "gclick", mode: config.mode, status: "not_configured" };
    },

    getCapabilities(): ProviderCapabilities {
      return REAL_CAPABILITIES;
    },

    clients: {
      // TODO_GCLICK_VALIDATION: mapear via GClickClientMapper.toExternalPayload(input)
      // e montar a request real (host/path/headers confirmados) quando a
      // especificação técnica oficial estiver acessível.
      async create(): Promise<ProviderResult<ExternalClient>> {
        return blocked();
      },
      async update(): Promise<ProviderResult<ExternalClient>> {
        return blocked();
      },
      async findById(): Promise<ProviderResult<ExternalClient | null>> {
        return blocked();
      },
      async findByExternalReference(): Promise<ProviderResult<ExternalClient | null>> {
        return blocked();
      },
      async list(): Promise<ProviderResult<PaginatedResult<ExternalClient>>> {
        return blocked();
      },
    },

    tasks: {
      // TODO_GCLICK_VALIDATION: "Listar tarefas"/"Criar pré-tarefa" existem
      // na documentação oficial (não são partner_only), mas sem schema
      // técnico confirmado nesta sessão - ver GClickTaskMapper.
      async list(): Promise<ProviderResult<PaginatedResult<ExternalTask>>> {
        return blocked();
      },
      async createPreTask(): Promise<ProviderResult<ExternalTask>> {
        return blocked();
      },
    },
  };
}
