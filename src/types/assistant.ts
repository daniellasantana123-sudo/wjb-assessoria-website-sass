/**
 * Estado geral do widget flutuante (avatar + painel). O fluxo interno do
 * painel (menu -> resposta do serviço -> qualificação) é controlado à parte
 * por `AssistantScreen`, em `assistant-storage.ts` - os dois juntos cobrem
 * os estados descritos no prompt mestre (closed/greeting/open/
 * collectingLead/redirecting/completed) sem precisar de vários `useState`
 * desconectados.
 */
export type AssistantWidgetState = "closed" | "greeting" | "open" | "minimized";

export type AssistantScreen = "menu" | "service" | "lead" | "completed";

/**
 * Chaves reais do menu principal - cada uma mapeia para um serviço/rota que
 * já existe no projeto (`src/lib/assistant/assistant-config.ts`). Nenhuma
 * delas é inventada.
 */
export type AssistantServiceKey =
  | "abrirEmpresa"
  | "trocarContador"
  | "contabilidadeCompleta"
  | "mei"
  | "simulador"
  | "departamentoPessoal"
  | "impostosRegularizacao"
  | "consultoria"
  | "outrosServicos"
  | "especialista";

export interface AssistantLead {
  name?: string;
  phone?: string;
  email?: string;
  service?: string;
  companyStatus?: string;
  taxRegime?: string;
  revenueRange?: string;
  employees?: string;
  sourcePage?: string;
}
