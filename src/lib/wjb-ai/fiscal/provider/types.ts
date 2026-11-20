import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";

/**
 * Contrato do conector fiscal (seção 7.2). O LLM NUNCA chama estas funções:
 * só o backend, depois de `evaluatePolicy` + autorização + aprovação, com o
 * snapshot imutável do rascunho.
 *
 * Neste incremento só existe `MockFiscalProvider`. O conector nacional
 * (SEFIN/ADN) só será escrito contra a documentação oficial vigente
 * conferida e em homologação (fase F4).
 */
export interface SubmissionRequest {
  tenantId: string;
  idempotencyKey: string;
  draft: NormalizedNfseDraft;
}

export type SubmissionOutcome =
  | { status: "AUTORIZADA"; officialId: string; simulated: boolean }
  | {
      status: "REJEITADA";
      rejectionCode: string;
      message: string;
      simulated: boolean;
    }
  | { status: "RESULTADO_INDETERMINADO"; simulated: boolean };

export interface FiscalProviderHealth {
  mode: "mock" | "homologacao" | "producao";
  simulated: boolean;
  available: boolean;
}

export interface FiscalProvider {
  readonly mode: FiscalProviderHealth["mode"];
  submitAuthorizedDocument(
    request: SubmissionRequest,
  ): Promise<SubmissionOutcome>;
  /** Consulta antes de reenviar: resposta ambígua nunca vira reenvio cego. */
  getSubmissionStatus(
    idempotencyKey: string,
  ): Promise<SubmissionOutcome | null>;
  getProviderHealth(): Promise<FiscalProviderHealth>;
}

export class FiscalProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalProviderUnavailableError";
  }
}
