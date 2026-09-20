export interface OmieClientInput {
  /** Id do tenant na WJB — usado como `codigo_cliente_integracao`, nunca como identidade de um usuário individual. */
  tenantId: string;
  /** Nome/razão social do tenant WJB — nunca o nome de um usuário individual. */
  name: string;
  cnpj: string | null;
  /** Código do cliente no Omie, se um mapeamento anterior já existir (atualização em vez de inclusão). */
  externalClientId?: string | null;
}

export interface OmieClientResult {
  ok: boolean;
  externalClientId?: string;
  /** Código de erro curto e sanitizado — nunca a resposta bruta da API (pode conter dados do app_secret/contexto). */
  error?: string;
}

/**
 * Contrato que qualquer provider de ERP/fiscal (Omie.G-Click ou outro)
 * precisa cumprir — Adapter Pattern (mesmo padrão de `docs/api/integrations.md`).
 * A aplicação nunca chama a API do Omie diretamente, só esta interface.
 *
 * Só `upsertClient` hoje: é o único recurso ("clientes") com API pública
 * bem documentada o suficiente para implementar com confiança sem uma
 * conta real para testar contra. "Tarefas"/"pré-tarefas" (mencionadas no
 * prompt da Fase 4) não têm documentação pública verificada nesta sessão
 * — ver `artifacts/wjb-saas-mvp/fase-4/decisions.md` D2. Adicionar aqui
 * quando a WJB fornecer a documentação oficial desses recursos.
 */
export interface OmieGClickAdapter {
  upsertClient(input: OmieClientInput): Promise<OmieClientResult>;
}
