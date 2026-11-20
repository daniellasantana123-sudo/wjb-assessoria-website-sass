import type {
  FiscalProvider,
  FiscalProviderHealth,
  SubmissionOutcome,
  SubmissionRequest,
} from "@/lib/wjb-ai/fiscal/provider/types";

export type MockScenario =
  "autorizada" | "rejeitada" | "indeterminado_depois_autorizada";

/**
 * Conector SIMULADO. Toda resposta leva `simulated: true` e identificador
 * com prefixo `SIMULADO-`, para nunca ser confundida com nota real.
 *
 * Idempotente por chave: reenviar a mesma chave devolve o mesmo resultado e
 * não "emite" de novo - é o comportamento que o conector real precisa ter e
 * que os testes de duplicidade exercitam.
 *
 * `indeterminado_depois_autorizada` reproduz o caso perigoso: o envio volta
 * sem resposta (timeout), mas a nota existe do outro lado; só a consulta de
 * status revela isso.
 */
export class MockFiscalProvider implements FiscalProvider {
  readonly mode = "mock" as const;
  private readonly results = new Map<string, SubmissionOutcome>();
  private sequence = 0;
  submissions = 0;

  constructor(private readonly scenario: MockScenario = "autorizada") {}

  async submitAuthorizedDocument(
    request: SubmissionRequest,
  ): Promise<SubmissionOutcome> {
    const existing = this.results.get(request.idempotencyKey);
    if (existing) return existing;

    this.submissions += 1;
    this.sequence += 1;
    const officialId = `SIMULADO-${String(this.sequence).padStart(6, "0")}`;

    if (this.scenario === "rejeitada") {
      const outcome: SubmissionOutcome = {
        status: "REJEITADA",
        rejectionCode: "SIM-001",
        message: "Rejeição simulada para teste.",
        simulated: true,
      };
      this.results.set(request.idempotencyKey, outcome);
      return outcome;
    }

    const authorized: SubmissionOutcome = {
      status: "AUTORIZADA",
      officialId,
      simulated: true,
    };
    this.results.set(request.idempotencyKey, authorized);
    if (this.scenario === "indeterminado_depois_autorizada") {
      return { status: "RESULTADO_INDETERMINADO", simulated: true };
    }
    return authorized;
  }

  async getSubmissionStatus(
    idempotencyKey: string,
  ): Promise<SubmissionOutcome | null> {
    return this.results.get(idempotencyKey) ?? null;
  }

  async getProviderHealth(): Promise<FiscalProviderHealth> {
    return { mode: "mock", simulated: true, available: true };
  }
}
