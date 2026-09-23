/**
 * Contratos internos da integração Omie.G-Click (Fase 6.5 do wjb-saas-mvp,
 * 2026-09-20 - "mocks e contratos internos"). Modelados pelas
 * necessidades da WJB, não copiados de nenhum schema externo - a
 * documentação oficial completa (Postman) não está acessível nesta
 * sessão, então nenhum nome de campo aqui deve ser lido como "confirmado
 * pela G-Click". Quando o schema real chegar, os `mappers/` são o único
 * lugar que precisa mudar para traduzir daqui pra lá e vice-versa.
 */

// ---------------------------------------------------------------------
// Modo do provider e saúde
// ---------------------------------------------------------------------

export type ProviderMode = "mock" | "sandbox" | "production";

export interface ProviderHealth {
  provider: "gclick";
  mode: ProviderMode;
  status: "available" | "not_configured" | "unavailable";
}

/**
 * O que o provider ATUAL sabe fazer de verdade - nunca liberar
 * `canReplyActivity`/`canCreatePreTaskWithTag` (`partner_only`,
 * confirmado na Fase 6.5) sem autorização comercial da Omie. No provider
 * real (ainda não implementado), tudo começa `false` - "unknown" na
 * prática, não uma promessa de capacidade.
 */
export interface ProviderCapabilities {
  canCreateClients: boolean;
  canUpdateClients: boolean;
  canFindClients: boolean;
  canListClients: boolean;
  canListTasks: boolean;
  canCreatePreTasks: boolean;
  /** partner_only - documentado oficialmente, nunca liberar sem autorização comercial. */
  canReplyActivity: boolean;
  /** partner_only - documentado oficialmente, nunca liberar sem autorização comercial. */
  canCreatePreTaskWithTag: boolean;
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------

export interface ExternalClient {
  /** `tenant.id` da WJB - nunca um usuário individual. */
  internalId: string;
  /** Id do cliente no G-Click. `null` até a primeira sincronização bem-sucedida. */
  externalId: string | null;
  /** Campo de correlação que a WJB controla (não confirmado se o G-Click tem um equivalente nativo). */
  externalReference: string;
  name: string;
  document: string | null;
  status: "active" | "inactive" | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateExternalClientInput {
  internalId: string;
  externalReference: string;
  name: string;
  document: string | null;
}

export interface UpdateExternalClientInput {
  externalId: string;
  name?: string;
  document?: string | null;
}

export interface ListExternalClientsInput {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------------
// Tarefas / pré-tarefas
// ---------------------------------------------------------------------

export interface ExternalTask {
  externalId: string;
  clientExternalId: string | null;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface ListExternalTasksInput {
  page?: number;
  pageSize?: number;
}

export interface CreateExternalPreTaskInput {
  clientExternalId: string;
  title: string;
  description?: string;
}

// ---------------------------------------------------------------------
// Erros padronizados (seção 17 do prompt) - independentes de HTTP externo
// ---------------------------------------------------------------------

export type ProviderErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "UNKNOWN_PROVIDER_ERROR";

export interface ProviderError {
  code: ProviderErrorCode;
  /** Sempre seguro de logar/exibir - nunca a resposta bruta do provider (pode conter credencial/contexto). */
  message: string;
  /** Só populado em `RATE_LIMITED`, quando o provider informar. */
  retryAfterMs?: number;
}

/**
 * Mesmo padrão já consolidado no projeto (`email`, `whatsapp-business`,
 * `antivirus`): adapter NUNCA lança exceção, sempre resolve com um
 * resultado tipado. Preferido aqui em vez do estilo de exceções do
 * exemplo conceitual do prompt - ver `decisions.md` D1.
 */
export type ProviderResult<T> =
  { ok: true; data: T } | { ok: false; error: ProviderError };

// ---------------------------------------------------------------------
// Contrato do provider
// ---------------------------------------------------------------------

/**
 * Contrato que qualquer provider de integração com a Omie.G-Click precisa
 * cumprir - Adapter Pattern. A aplicação nunca chama a API do G-Click
 * diretamente, só esta interface, resolvida via `getOmieGClickAdapter()`.
 *
 * Implementações: `MockGClickProvider` (funcional, determinística) e
 * `GClickHttpProvider` (esqueleto - todo método resolve
 * `PROVIDER_NOT_CONFIGURED`, nenhuma chamada de rede real até a
 * especificação técnica oficial ser confirmada). Ver
 * `docs/integrations/gclick/PENDING_VALIDATION.md`.
 */
export interface OmieGClickAdapter {
  healthCheck(): Promise<ProviderHealth>;
  getCapabilities(): ProviderCapabilities;

  clients: {
    create(
      input: CreateExternalClientInput,
    ): Promise<ProviderResult<ExternalClient>>;
    update(
      input: UpdateExternalClientInput,
    ): Promise<ProviderResult<ExternalClient>>;
    findById(
      externalId: string,
    ): Promise<ProviderResult<ExternalClient | null>>;
    findByExternalReference(
      reference: string,
    ): Promise<ProviderResult<ExternalClient | null>>;
    list(
      input?: ListExternalClientsInput,
    ): Promise<ProviderResult<PaginatedResult<ExternalClient>>>;
  };

  tasks: {
    list(
      input?: ListExternalTasksInput,
    ): Promise<ProviderResult<PaginatedResult<ExternalTask>>>;
    createPreTask(
      input: CreateExternalPreTaskInput,
    ): Promise<ProviderResult<ExternalTask>>;
  };
}
