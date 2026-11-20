import { describe, expect, it } from "vitest";

import {
  MockFiscalProvider,
  scenarioByAmount,
} from "@/lib/wjb-ai/fiscal/provider";
import type {
  FiscalProvider,
  SubmissionOutcome,
} from "@/lib/wjb-ai/fiscal/provider/types";
import {
  MAX_ATTEMPTS,
  processQueue,
  type QueueJob,
  type QueueRepo,
} from "@/lib/wjb-ai/fiscal/queue";
import { checkSendReadiness, planReview } from "@/lib/wjb-ai/fiscal/review";
import { canTransition, type FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

const draft = (cents: number) => ({
  serviceDescription: "Serviço fictício",
  amountCents: cents,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF" as const,
    name: "Tomador",
  },
});

function fakeRepo(
  jobs: QueueJob[],
  opts: { authorizedAttempt?: boolean; stealOn?: FiscalStatus } = {},
) {
  const db = new Map(jobs.map((j) => [j.id, { ...j }]));
  const log = {
    transitions: [] as string[],
    attempts: [] as string[],
    retries: [] as { attempt: number; intervention: boolean }[],
  };
  const repo: QueueRepo = {
    async claimDue() {
      return [...db.values()].map((j) => ({ ...j, draft: j.draft }));
    },
    async transition(job, from, to, reason) {
      const row = db.get(job.id)!;
      if (row.status !== from || opts.stealOn === to) return false;
      if (from !== to && !canTransition(from, to))
        throw new Error(`salto inválido ${from}->${to}`);
      row.status = to;
      log.transitions.push(from === to ? `=${to}` : to);
      void reason;
      return true;
    },
    async recordAttempt(_job, outcome) {
      log.attempts.push(outcome.status);
    },
    async hasAuthorizedAttempt() {
      return !!opts.authorizedAttempt;
    },
    async scheduleRetry(_job, attempt, _next, _err, intervention) {
      log.retries.push({ attempt, intervention });
    },
  };
  return { repo, db, log };
}
const job = (
  cents: number,
  status: FiscalStatus = "AUTORIZADA_PARA_ENVIO",
  attemptCount = 0,
): QueueJob => ({
  id: `r-${cents}`,
  tenantId: "t-a",
  status,
  idempotencyKey: `k-${cents}`,
  draft: draft(cents),
  attemptCount,
});
const provider = () => new MockFiscalProvider("autorizada", scenarioByAmount);
const now = new Date("2026-11-20T12:00:00Z");

describe("fila de envio simulada", () => {
  it("módulo desligado não processa nada (kill switch)", async () => {
    const { repo, log } = fakeRepo([job(8000)]);
    expect(
      await processQueue({
        moduleEnabled: false,
        repo,
        provider: provider(),
        now,
      }),
    ).toEqual({ stopped: true });
    expect(log.transitions).toHaveLength(0);
  });

  it("caminho normal: fila, envio, autorizada (simulada)", async () => {
    const { repo, log, db } = fakeRepo([job(8000)]);
    const p = provider();
    const s = await processQueue({
      moduleEnabled: true,
      repo,
      provider: p,
      now,
    });
    expect(log.transitions).toEqual(["ENFILEIRADA", "ENVIANDO", "AUTORIZADA"]);
    expect(db.get("r-8000")!.status).toBe("AUTORIZADA");
    expect(p.submissions).toBe(1);
    expect(s).toMatchObject({ authorized: 1 });
  });

  it("rejeição simulada termina em REJEITADA", async () => {
    const { repo, db } = fakeRepo([job(8066)]);
    await processQueue({
      moduleEnabled: true,
      repo,
      provider: provider(),
      now,
    });
    expect(db.get("r-8066")!.status).toBe("REJEITADA");
  });

  it("resposta indeterminada é conciliada pela consulta, com um único envio", async () => {
    const { repo, log, db } = fakeRepo([job(8013)]);
    const p = provider();
    await processQueue({ moduleEnabled: true, repo, provider: p, now });
    expect(log.transitions).toEqual([
      "ENFILEIRADA",
      "ENVIANDO",
      "RESULTADO_INDETERMINADO",
      "CONCILIACAO_OFICIAL",
      "AUTORIZADA",
    ]);
    expect(db.get("r-8013")!.status).toBe("AUTORIZADA");
    expect(p.submissions).toBe(1);
  });

  it("falha do conector nunca vira rejeição: agenda nova tentativa", async () => {
    const failing: FiscalProvider = {
      mode: "mock",
      async submitAuthorizedDocument(): Promise<SubmissionOutcome> {
        throw new Error("timeout simulado");
      },
      async getSubmissionStatus() {
        return null;
      },
      async getProviderHealth() {
        return { mode: "mock", simulated: true, available: false };
      },
    };
    const { repo, log, db } = fakeRepo([job(8000)]);
    await processQueue({ moduleEnabled: true, repo, provider: failing, now });
    expect(db.get("r-8000")!.status).toBe("CONCILIACAO_OFICIAL");
    expect(log.transitions).not.toContain("REJEITADA");
    expect(log.retries).toEqual([{ attempt: 1, intervention: false }]);
  });

  it("no limite de tentativas o pedido vai para a fila de erros", async () => {
    const failing: FiscalProvider = {
      mode: "mock",
      async submitAuthorizedDocument(): Promise<SubmissionOutcome> {
        throw new Error("fora do ar");
      },
      async getSubmissionStatus() {
        return null;
      },
      async getProviderHealth() {
        return { mode: "mock", simulated: true, available: false };
      },
    };
    const { repo, log } = fakeRepo([
      job(8000, "CONCILIACAO_OFICIAL", MAX_ATTEMPTS - 1),
    ]);
    await processQueue({ moduleEnabled: true, repo, provider: failing, now });
    expect(log.retries).toEqual([
      { attempt: MAX_ATTEMPTS, intervention: true },
    ]);
  });

  it("tentativa já autorizada antes: conclui sem reenviar", async () => {
    const { repo, db } = fakeRepo([job(8000)], { authorizedAttempt: true });
    const p = provider();
    await processQueue({ moduleEnabled: true, repo, provider: p, now });
    expect(db.get("r-8000")!.status).toBe("AUTORIZADA");
    expect(p.submissions).toBe(0);
  });

  it("se outro processador já pegou o pedido, este não envia", async () => {
    const { repo } = fakeRepo([job(8000)], { stealOn: "ENVIANDO" });
    const p = provider();
    const s = await processQueue({
      moduleEnabled: true,
      repo,
      provider: p,
      now,
    });
    expect(p.submissions).toBe(0);
    expect(s).toMatchObject({ skipped: 1 });
  });
});

describe("revisão do contador", () => {
  it("aprovar leva a CONFIRMADA mantendo a confirmação do cliente", () => {
    const r = planReview("REVISAO_HUMANA", "approve", "");
    expect(r.ok && r.steps.map((s) => s.to)).toEqual([
      "PRONTA_PARA_CONFIRMACAO",
      "CONFIRMADA",
    ]);
  });
  it("pedir correção e bloquear exigem motivo", () => {
    expect(planReview("REVISAO_HUMANA", "block", "curto").ok).toBe(false);
    expect(
      planReview(
        "REVISAO_HUMANA",
        "request_data",
        "Falta o CNPJ correto do tomador",
      ).ok,
    ).toBe(true);
  });
  it("só pedidos em revisão recebem decisão", () => {
    expect(planReview("CONFIRMADA", "approve", "").ok).toBe(false);
  });
  it("envio exige confirmada, perfil aprovado, autorização válida e conector simulado", () => {
    const base = {
      status: "CONFIRMADA" as const,
      hasApprovedProfile: true,
      grantValidUntil: "2027-01-01",
      providerMode: "mock" as const,
      today: "2026-11-20",
    };
    expect(checkSendReadiness(base)).toEqual({ ok: true });
    expect(
      checkSendReadiness({ ...base, grantValidUntil: "2026-11-19" }).ok,
    ).toBe(false);
    expect(checkSendReadiness({ ...base, providerMode: "producao" }).ok).toBe(
      false,
    );
    expect(checkSendReadiness({ ...base, hasApprovedProfile: false }).ok).toBe(
      false,
    );
  });
});
