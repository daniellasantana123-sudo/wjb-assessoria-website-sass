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
  /**
   * Categoria da tarefa no G-Click. A API separa "Obrigacao" (prazo
   * fiscal) de "Solicitacao" (pedido pontual) - só a primeira vira
   * obrigação no Portal.
   */
  category?: "Obrigacao" | "Solicitacao";
  /**
   * `dataAcaoInicio` - início da janela de datas, em `YYYY-MM-DD`.
   *
   * **Obrigatório na prática**: sem ele (e sem `categoria`) o endpoint
   * responde **HTTP 500**, não um erro de validação - confirmado em
   * produção em 2026-09-24.
   */
  actionDateFrom?: string;
}

export interface CreateExternalPreTaskInput {
  clientExternalId: string;
  title: string;
  description?: string;
}

// ---------------------------------------------------------------------
// Pessoas, atividades e catálogos (2026-09-24 - cobertura do restante dos
// endpoints públicos da coleção oficial)
// ---------------------------------------------------------------------

/**
 * Pessoa ligada a um cliente ou a uma tarefa no G-Click (responsável,
 * convidado). Um só tipo para os três endpoints porque a API devolve o
 * mesmo formato de usuário nos três - criar três tipos idênticos só
 * aumentaria a superfície a manter.
 */
export interface ExternalPerson {
  externalId: string;
  name: string;
  email: string | null;
  /** Papel declarado pela API quando existir (ex.: "responsável"). */
  role: string | null;
}

/**
 * Etapa de uma tarefa - é o que dá o andamento detalhado, além de
 * pendente/concluída. A API não devolve um "status" textual aqui: devolve
 * `respondida` (booleano) mais quem respondeu e quando, e é assim que o
 * tipo reflete a resposta, sem inventar um estado intermediário.
 */
export interface ExternalTaskActivity {
  externalId: string;
  name: string;
  order: number | null;
  type: string | null;
  answered: boolean;
  answeredBy: string | null;
  answeredAt: string | null;
}

/**
 * Item de catálogo do G-Click (grupo, visibilidade, fluxo). Mesmo motivo
 * do `ExternalPerson`: os três endpoints devolvem id + nome, e um tipo só
 * evita três cópias da mesma forma.
 */
export interface ExternalCatalogItem {
  externalId: string;
  name: string;
  description: string | null;
}

/**
 * Uma linha da carteira: a empresa e quem a atende. A API devolve os dois
 * juntos (`cliente` + `usuario`), e é essa dupla que torna o endpoint útil
 * - a lista de clientes sozinha já vem de `/clientes`.
 */
export interface ExternalPortfolioItem {
  clientExternalId: string;
  name: string;
  document: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
}

/**
 * Sócios são referenciados por **id de cadastro já existente** no G-Click
 * (`{ sociosIds: [...] }`), nunca por nome/CPF - a API espera pessoas que
 * já existem lá, não cria ninguém a partir destes dados.
 */
export interface SetExternalPartnersInput {
  clientExternalId: string;
  partnerIds: string[];
}

export interface SearchInput {
  text: string;
  page?: number;
  pageSize?: number;
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
    /** `GET /clientes/search` - busca por texto livre (nome, CNPJ). */
    search(
      input: SearchInput,
    ): Promise<ProviderResult<PaginatedResult<ExternalClient>>>;
    /** `GET /clientes/{id}/responsaveis` - quem na WJB atende aquela empresa. */
    listResponsibles(
      clientExternalId: string,
    ): Promise<ProviderResult<ExternalPerson[]>>;
    /** `PUT /clientes/{id}/socios` - vincula sócios já cadastrados no G-Click. */
    setPartners(input: SetExternalPartnersInput): Promise<ProviderResult<void>>;
    /** `DELETE /clientes/{id}/socios` - desvincula os sócios informados. */
    removePartners(
      input: SetExternalPartnersInput,
    ): Promise<ProviderResult<void>>;
  };

  tasks: {
    list(
      input?: ListExternalTasksInput,
    ): Promise<ProviderResult<PaginatedResult<ExternalTask>>>;
    createPreTask(
      input: CreateExternalPreTaskInput,
    ): Promise<ProviderResult<ExternalTask>>;
    /** `GET /tarefas/{id}/responsaveis`. */
    listResponsibles(taskId: string): Promise<ProviderResult<ExternalPerson[]>>;
    /** `GET /tarefas/{id}/convidados`. */
    listGuests(taskId: string): Promise<ProviderResult<ExternalPerson[]>>;
    /** `GET /tarefas/{id}/atividades` - as etapas, para mostrar andamento. */
    listActivities(
      taskId: string,
    ): Promise<ProviderResult<ExternalTaskActivity[]>>;
  };

  /**
   * Catálogos da conta. `groups` e `visibilities` cobrem dois endpoints
   * cada (listagem e `/busca`): um método com `search` opcional em vez de
   * dois quase idênticos - quem chama não ganha nada em escolher a URL.
   */
  catalog: {
    groups(search?: string): Promise<ProviderResult<ExternalCatalogItem[]>>;
    visibilities(
      search?: string,
    ): Promise<ProviderResult<ExternalCatalogItem[]>>;
    flows(): Promise<ProviderResult<ExternalCatalogItem[]>>;
    portfolio(): Promise<ProviderResult<ExternalPortfolioItem[]>>;
  };
}
