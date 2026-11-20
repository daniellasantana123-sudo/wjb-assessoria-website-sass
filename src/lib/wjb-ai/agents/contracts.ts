/**
 * Contratos dos 6 agentes do WJB AI (doc 14). PREPARAÇÃO: nenhum agente
 * chama modelo de IA nesta fase; não há provedor contratado nem avaliação de
 * LGPD concluída. O que existe aqui é a fronteira de segurança que qualquer
 * implementação futura terá de respeitar:
 *
 * - toda ferramenta declara o efeito; NENHUMA tem efeito de transmissão
 *   fiscal (o envio é só do processamento da fila, após aprovação humana);
 * - cada agente tem lista fechada de ferramentas (`assertToolAllowed`);
 * - a empresa sempre vem da sessão no servidor, nunca do agente.
 */
export type ToolEffect = "read" | "draft" | "human_task" | "audit";

export interface ToolContract {
  name: string;
  effect: ToolEffect;
  description: string;
  /** Campos pessoais que a ferramenta pode devolver ao modelo (minimização). */
  returnsPersonalData: boolean;
}

export const TOOLS = {
  get_authenticated_client_context: { name: "get_authenticated_client_context", effect: "read", description: "Empresa ativa e papel do usuário, resolvidos no servidor.", returnsPersonalData: false },
  get_approved_fiscal_profile: { name: "get_approved_fiscal_profile", effect: "read", description: "Perfil fiscal aprovado da empresa da sessão (limites, versão).", returnsPersonalData: false },
  get_request_status: { name: "get_request_status", effect: "read", description: "Status e andamento de um pedido da empresa da sessão.", returnsPersonalData: false },
  extract_invoice_intent: { name: "extract_invoice_intent", effect: "read", description: "Extrai do texto um JSON de rascunho; o backend revalida com o schema estrito.", returnsPersonalData: false },
  list_required_fields: { name: "list_required_fields", effect: "read", description: "Campos que faltam para o rascunho.", returnsPersonalData: false },
  validate_draft: { name: "validate_draft", effect: "read", description: "Validação determinística (parseNfseDraft + evaluatePolicy).", returnsPersonalData: false },
  create_fiscal_draft: { name: "create_fiscal_draft", effect: "draft", description: "Cria pedido em RECEBIDA via RLS do usuário; nunca transmite.", returnsPersonalData: false },
  create_human_review_task: { name: "create_human_review_task", effect: "human_task", description: "Encaminha ao contador com o motivo.", returnsPersonalData: false },
  record_agent_event: { name: "record_agent_event", effect: "audit", description: "Registra ação/erro do agente na trilha de auditoria.", returnsPersonalData: false },
} as const satisfies Record<string, ToolContract>;

export type ToolName = keyof typeof TOOLS;

export interface AgentContract {
  id: string;
  name: string;
  usesLlm: boolean;
  tools: ToolName[];
  never: string[];
}

export const AGENTS: AgentContract[] = [
  { id: "atendimento", name: "Atendimento", usesLlm: true, tools: ["get_authenticated_client_context", "get_request_status", "create_human_review_task", "record_agent_event"], never: ["prometer prazo", "dizer que a nota foi emitida sem retorno oficial"] },
  { id: "cadastro", name: "Cadastro", usesLlm: false, tools: ["get_authenticated_client_context", "get_approved_fiscal_profile"], never: ["ler outra empresa", "aceitar empresa vinda do modelo"] },
  { id: "fiscal", name: "Fiscal", usesLlm: true, tools: ["extract_invoice_intent", "list_required_fields", "create_fiscal_draft"], never: ["escolher código de serviço, alíquota ou retenção"] },
  { id: "validacao", name: "Validação", usesLlm: false, tools: ["validate_draft"], never: ["ser substituído por modelo de IA"] },
  { id: "supervisao", name: "Supervisão", usesLlm: false, tools: ["create_human_review_task", "get_request_status"], never: ["aprovar no lugar do contador"] },
  { id: "auditoria", name: "Auditoria", usesLlm: false, tools: ["record_agent_event", "get_request_status"], never: ["apagar ou editar eventos"] },
];

export class ToolNotAllowedError extends Error {}

/** Barreira obrigatória antes de executar qualquer chamada de ferramenta de um agente. */
export function assertToolAllowed(agentId: string, tool: string): ToolContract {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) throw new ToolNotAllowedError(`Agente desconhecido: ${agentId}`);
  if (!(agent.tools as string[]).includes(tool)) throw new ToolNotAllowedError(`${agent.name} não pode usar ${tool}`);
  return TOOLS[tool as ToolName];
}
