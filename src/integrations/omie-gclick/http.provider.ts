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
 *
 * **Checkpoint 6.5.1 - duas proteções independentes** (seções 1/2):
 * 1. Feature flag (`GCLICK_REAL_INTEGRATION_ENABLED`) - decidida no
 *    factory (`provider.ts`), chega aqui como `options.blockedByFeatureFlag`.
 * 2. `REAL_PROVIDER_IMPLEMENTED` (abaixo) - hardcoded em código, não uma
 *    env var. Ninguém consegue "ligar" a integração real só mexendo em
 *    configuração; só uma mudança de código (depois que a especificação
 *    técnica da G-Click for confirmada) vira isto `true`.
 *
 * As duas são checadas de forma independente em `isRealIntegrationAvailable()`
 * - mesmo que a Proteção 1 esteja "aberta" (flag = true), a Proteção 2
 * continua bloqueando sozinha, e vice-versa.
 */
const REAL_PROVIDER_IMPLEMENTED = false as const;

/** Exportado só pra o Checkpoint 6.5.1 confirmar via teste que continua `false`. */
export function isRealProviderImplemented(): boolean {
  return REAL_PROVIDER_IMPLEMENTED;
}

export interface GClickHttpProviderOptions {
  /** Proteção 1 - `true` quando `GCLICK_REAL_INTEGRATION_ENABLED` != "true". Decidida no factory, nunca aqui. */
  blockedByFeatureFlag: boolean;
}

function isRealIntegrationAvailable(options: GClickHttpProviderOptions): boolean {
  return !options.blockedByFeatureFlag && REAL_PROVIDER_IMPLEMENTED;
}

function blockedMessage(options: GClickHttpProviderOptions): string {
  if (options.blockedByFeatureFlag) {
    return 'Integração real G-Click desabilitada (GCLICK_REAL_INTEGRATION_ENABLED != "true").';
  }
  return "G-Click real integration is disabled. Official API configuration has not yet been validated (TODO_GCLICK_VALIDATION).";
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

/**
 * `config.timeoutMs` (`GCLICK_TIMEOUT_MS`) já existe como configuração
 * interna (Checkpoint 6.5.1, seção 19), mas só será efetivamente usado
 * quando uma chamada de rede real existir aqui dentro (via
 * `AbortController`, mesmo padrão já usado no adapter Meta WhatsApp) -
 * hoje nenhum método chega a fazer uma requisição, então não há o que
 * limitar por tempo ainda.
 */
export function createGClickHttpProvider(
  config: GClickConfig,
  options: GClickHttpProviderOptions,
): OmieGClickAdapter {
  function blocked<T>(): ProviderResult<T> {
    return {
      ok: false,
      error: { code: "PROVIDER_NOT_CONFIGURED", message: blockedMessage(options) },
    };
  }

  return {
    async healthCheck(): Promise<ProviderHealth> {
      return {
        provider: "gclick",
        mode: config.mode,
        status: isRealIntegrationAvailable(options) ? "available" : "not_configured",
      };
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
