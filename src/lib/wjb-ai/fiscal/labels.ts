import type { FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Rótulo ÚNICO de simulação (Fase 10B). Toda tela, arquivo, notificação, API
 * e mensagem do assistente sobre NFS-e usa este texto enquanto não houver
 * emissão oficial: nada do que o módulo gera hoje tem valor fiscal.
 */
export const SIMULATION_LABEL = "SIMULAÇÃO - SEM VALOR FISCAL";

/**
 * Texto de cada estado para o cliente. Nenhum estado anterior a AUTORIZADA
 * fala em "nota emitida".
 */
export const FISCAL_STATUS_LABELS: Record<FiscalStatus, string> = {
  RECEBIDA: "Recebida",
  TRIAGEM: "Em triagem",
  DADOS_PENDENTES: "Faltam dados",
  VALIDACAO_FISCAL: "Em validação",
  BLOQUEADA: "Bloqueada",
  REVISAO_HUMANA: "Em revisão pelo contador",
  PRONTA_PARA_CONFIRMACAO: "Aguardando sua confirmação",
  CONFIRMADA: "Confirmada, aguardando envio",
  AUTORIZADA_PARA_ENVIO: "Liberada para envio",
  ENFILEIRADA: "Na fila de envio",
  ENVIANDO: "Enviando",
  RESULTADO_INDETERMINADO: "Conferindo retorno",
  CONCILIACAO_OFICIAL: "Conferindo retorno",
  REJEITADA: "Rejeitada",
  AUTORIZADA: "Autorizada",
  DOCUMENTOS_DISPONIVEIS: "Documentos disponíveis",
  NOTIFICADA: "Concluída",
};

export const FISCAL_STATUS_TONE: Partial<
  Record<FiscalStatus, "warning" | "danger" | "success">
> = {
  REVISAO_HUMANA: "warning",
  DADOS_PENDENTES: "warning",
  BLOQUEADA: "danger",
  REJEITADA: "danger",
  AUTORIZADA: "success",
  DOCUMENTOS_DISPONIVEIS: "success",
  NOTIFICADA: "success",
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
