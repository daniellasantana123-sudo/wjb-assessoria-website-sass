/**
 * Máquina de estados da solicitação fiscal (seção 5.4 do documento mestre).
 * Transição fora desta tabela é rejeitada. Cancelar, substituir e corrigir
 * NÃO são estados daqui: são fluxos próprios, a projetar.
 */
export const FISCAL_STATUSES = [
  "RECEBIDA",
  "TRIAGEM",
  "DADOS_PENDENTES",
  "VALIDACAO_FISCAL",
  "BLOQUEADA",
  "REVISAO_HUMANA",
  "PRONTA_PARA_CONFIRMACAO",
  "CONFIRMADA",
  "AUTORIZADA_PARA_ENVIO",
  "ENFILEIRADA",
  "ENVIANDO",
  "RESULTADO_INDETERMINADO",
  "CONCILIACAO_OFICIAL",
  "REJEITADA",
  "AUTORIZADA",
  "DOCUMENTOS_DISPONIVEIS",
  "NOTIFICADA",
] as const;

export type FiscalStatus = (typeof FISCAL_STATUSES)[number];

const TRANSITIONS: Record<FiscalStatus, readonly FiscalStatus[]> = {
  RECEBIDA: ["TRIAGEM"],
  TRIAGEM: [
    "DADOS_PENDENTES",
    "VALIDACAO_FISCAL",
    "BLOQUEADA",
    "REVISAO_HUMANA",
  ],
  DADOS_PENDENTES: ["TRIAGEM"],
  VALIDACAO_FISCAL: ["BLOQUEADA", "REVISAO_HUMANA", "PRONTA_PARA_CONFIRMACAO"],
  BLOQUEADA: [],
  REVISAO_HUMANA: ["PRONTA_PARA_CONFIRMACAO", "BLOQUEADA", "DADOS_PENDENTES"],
  PRONTA_PARA_CONFIRMACAO: ["CONFIRMADA", "DADOS_PENDENTES"],
  CONFIRMADA: ["AUTORIZADA_PARA_ENVIO", "REVISAO_HUMANA"],
  AUTORIZADA_PARA_ENVIO: ["ENFILEIRADA"],
  ENFILEIRADA: ["ENVIANDO"],
  // Timeout ou erro de rede NUNCA vira REJEITADA: vai para indeterminado e
  // depois para conciliação com a consulta oficial (seção 7.4).
  ENVIANDO: ["AUTORIZADA", "REJEITADA", "RESULTADO_INDETERMINADO"],
  RESULTADO_INDETERMINADO: ["CONCILIACAO_OFICIAL"],
  CONCILIACAO_OFICIAL: ["AUTORIZADA", "REJEITADA", "RESULTADO_INDETERMINADO"],
  REJEITADA: [],
  AUTORIZADA: ["DOCUMENTOS_DISPONIVEIS"],
  DOCUMENTOS_DISPONIVEIS: ["NOTIFICADA"],
  NOTIFICADA: [],
};

export function canTransition(from: FiscalStatus, to: FiscalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidFiscalTransitionError extends Error {
  constructor(
    readonly from: FiscalStatus,
    readonly to: FiscalStatus,
  ) {
    super(`Transição fiscal inválida: ${from} -> ${to}`);
    this.name = "InvalidFiscalTransitionError";
  }
}

export function assertTransition(
  from: FiscalStatus,
  to: FiscalStatus,
): FiscalStatus {
  if (!canTransition(from, to))
    throw new InvalidFiscalTransitionError(from, to);
  return to;
}

/** "Nota emitida" só pode ser dita nestes estados (há retorno oficial). */
export function isOfficiallyAuthorized(status: FiscalStatus): boolean {
  return (
    status === "AUTORIZADA" ||
    status === "DOCUMENTOS_DISPONIVEIS" ||
    status === "NOTIFICADA"
  );
}
