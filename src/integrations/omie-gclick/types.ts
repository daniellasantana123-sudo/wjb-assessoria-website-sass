export interface OmieClientInput {
  /** Id do tenant na WJB - identificador de correlação com o sistema externo, nunca a identidade de um usuário individual. */
  tenantId: string;
  /** Nome/razão social do tenant WJB - nunca o nome de um usuário individual. */
  name: string;
  cnpj: string | null;
  /** Identificador do cliente no G-Click, se um mapeamento anterior já existir (atualização em vez de inclusão). */
  externalClientId?: string | null;
}

export interface OmieClientResult {
  ok: boolean;
  externalClientId?: string;
  /** Código de erro curto e sanitizado - nunca a resposta bruta da API (pode conter dados de credencial/contexto). */
  error?: string;
}

export interface OmieConnectionResult {
  ok: boolean;
  error?: string;
}

/**
 * Contrato que o provider de integração com a Omie.G-Click precisa
 * cumprir - Adapter Pattern (mesmo padrão de `docs/api/integrations.md`).
 * A aplicação nunca chama a API do G-Click diretamente, só esta interface.
 *
 * Status: BLOCKED_BY_PROVIDER (Fase 6.5, 2026-09-20) - nenhuma
 * implementação real hoje (`getOmieGClickAdapter()` sempre devolve o
 * adapter no-op). A Fase 4 havia implementado `upsertClient` contra a API
 * do Omie ERP (`app.omie.com.br`), mas a auditoria técnica da Fase 6.5
 * confirmou, via documentação oficial (ajuda.omie.com.br), que a
 * Omie.G-Click API é um produto separado, com autenticação e endpoints
 * próprios - a implementação anterior estava incorreta e foi removida.
 * A especificação técnica completa (host, endpoints, schemas) só existe
 * na documentação Postman oficial, que não pôde ser lida nesta sessão
 * (conteúdo renderizado via JavaScript) - ver
 * `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md` e `api-validation.md`.
 *
 * "Tarefas"/"pré-tarefas" continuam fora da interface - a documentação
 * oficial as lista, mas 2 dos recursos relacionados ("Responder
 * atividade", "Criar pre-tarefa com tag") são explicitamente
 * `partner_only`, e o restante não tem schema técnico confirmado nesta
 * sessão. Ver `omie-contact-checklist.md`.
 */
export interface OmieGClickAdapter {
  upsertClient(input: OmieClientInput): Promise<OmieClientResult>;
  /**
   * Verifica só se as credenciais autenticam contra a API da G-Click
   * ("testar conexão" do console admin), sem criar nem alterar nenhum
   * cliente. Nunca lança, mesmo contrato de `upsertClient`.
   */
  testConnection(): Promise<OmieConnectionResult>;
}
