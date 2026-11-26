import { SIMULATION_LABEL } from "@/lib/wjb-ai/fiscal/labels";

/**
 * Textos dos avisos ao cliente sobre a solicitação de NFS-e (F3). Sem dado
 * pessoal: nada de CPF/CNPJ do tomador nem valores; o detalhe fica na tela
 * do Portal, atrás do login.
 */
export type FiscalNoticeKind =
  | "approved"
  | "correction_requested"
  | "blocked"
  | "authorized_simulated"
  | "rejected_simulated";

export function buildFiscalNotice(
  kind: FiscalNoticeKind,
  requestId: string,
  note?: string,
) {
  const link = `/portal/nfse/${requestId}`;
  const reason = note?.trim() ? ` Motivo: ${note.trim().slice(0, 300)}` : "";
  const body: Record<FiscalNoticeKind, string> = {
    approved:
      "Sua solicitação de NFS-e foi revisada pela WJB e seguirá para o envio simulado. Nenhuma nota é emitida nesta fase.",
    correction_requested: `A WJB pediu uma correção na sua solicitação de NFS-e.${reason}`,
    blocked: `Sua solicitação de NFS-e não poderá seguir.${reason}`,
    authorized_simulated:
      "Sua solicitação de NFS-e foi processada em ambiente de SIMULAÇÃO. Nenhuma nota foi emitida.",
    rejected_simulated:
      "O processamento simulado da sua solicitação de NFS-e retornou uma rejeição. Veja os detalhes.",
  };
  const type =
    kind === "authorized_simulated" || kind === "rejected_simulated"
      ? "fiscal_request.processed"
      : "fiscal_request.reviewed";
  // Fase 10B: todo aviso de NFS-e termina com o rótulo único de simulação.
  return {
    type,
    body: `${body[kind]} (${SIMULATION_LABEL})`,
    link,
  } as const;
}
