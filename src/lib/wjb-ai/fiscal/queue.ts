import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import type { FiscalProvider, SubmissionOutcome } from "@/lib/wjb-ai/fiscal/provider/types";
import { canTransition, type FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

/**
 * Processamento da fila de envio (F3). Roda fora de requisição comum: uma
 * rota agendada chama `processQueue` em lotes pequenos.
 *
 * Regras de segurança (seção 7.4 do documento mestre):
 * - nunca reenvia sem antes consultar o resultado pela chave de idempotência;
 * - timeout/erro de rede NUNCA vira rejeição: vira resultado indeterminado e
 *   conciliação;
 * - cada passo só acontece se o pedido ainda estiver no estado esperado
 *   (dois processadores ao mesmo tempo não enviam duas vezes);
 * - depois de MAX_ATTEMPTS, o pedido para e vai para a fila de erros.
 */
export const MAX_ATTEMPTS = 5;
export const BACKOFF_MINUTES = [1, 2, 4, 8, 16];

export interface QueueJob {
  id: string;
  tenantId: string;
  status: FiscalStatus;
  idempotencyKey: string;
  draft: NormalizedNfseDraft;
  attemptCount: number;
}

export interface QueueRepo {
  claimDue(now: Date, limit: number): Promise<QueueJob[]>;
  /** Muda o estado só se ainda estiver em `from`. Devolve false se outro processador já mexeu. */
  transition(job: QueueJob, from: FiscalStatus, to: FiscalStatus, reason: string): Promise<boolean>;
  recordAttempt(job: QueueJob, outcome: SubmissionOutcome): Promise<void>;
  hasAuthorizedAttempt(job: QueueJob): Promise<boolean>;
  scheduleRetry(job: QueueJob, attemptCount: number, nextAttemptAt: Date, error: string, intervention: boolean): Promise<void>;
}

export interface QueueSummary {
  processed: number;
  authorized: number;
  rejected: number;
  retried: number;
  intervention: number;
  skipped: number;
}

function backoff(attempt: number, now: Date): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
  return new Date(now.getTime() + minutes * 60_000);
}

async function step(repo: QueueRepo, job: QueueJob, to: FiscalStatus, reason: string): Promise<boolean> {
  if (!canTransition(job.status, to)) return false;
  const ok = await repo.transition(job, job.status, to, reason);
  if (ok) job.status = to;
  return ok;
}

async function finalize(repo: QueueRepo, job: QueueJob, outcome: SubmissionOutcome, summary: QueueSummary) {
  if (outcome.status === "AUTORIZADA") {
    await step(repo, job, "AUTORIZADA", `Retorno do conector ${outcome.simulated ? "SIMULADO" : "oficial"}: ${outcome.officialId}.`);
    summary.authorized++;
  } else if (outcome.status === "REJEITADA") {
    await step(repo, job, "REJEITADA", `Rejeição ${outcome.simulated ? "simulada" : ""} ${outcome.rejectionCode}: ${outcome.message}`.replace("  ", " "));
    summary.rejected++;
  }
}

async function retryOrStop(repo: QueueRepo, job: QueueJob, now: Date, error: string, summary: QueueSummary) {
  const attempt = job.attemptCount + 1;
  const intervention = attempt >= MAX_ATTEMPTS;
  await repo.scheduleRetry(job, attempt, backoff(attempt, now), error, intervention);
  if (intervention) summary.intervention++;
  else summary.retried++;
}

export async function processQueue(input: {
  moduleEnabled: boolean;
  repo: QueueRepo;
  provider: FiscalProvider;
  now: Date;
  limit?: number;
}): Promise<QueueSummary | { stopped: true }> {
  if (!input.moduleEnabled) return { stopped: true };
  const { repo, provider, now } = input;
  const summary: QueueSummary = { processed: 0, authorized: 0, rejected: 0, retried: 0, intervention: 0, skipped: 0 };

  for (const job of await repo.claimDue(now, input.limit ?? 10)) {
    summary.processed++;
    try {
      if (job.status === "AUTORIZADA_PARA_ENVIO") {
        if (!(await step(repo, job, "ENFILEIRADA", "Entrou na fila de envio."))) { summary.skipped++; continue; }
        if (!(await step(repo, job, "ENVIANDO", `Enviando ao conector (${provider.mode}).`))) { summary.skipped++; continue; }
      }

      // Antes de qualquer envio: já existe resultado para esta chave?
      if (await repo.hasAuthorizedAttempt(job)) {
        if (job.status === "ENVIANDO") await step(repo, job, "RESULTADO_INDETERMINADO", "Tentativa anterior já autorizada; conferindo.");
        if (job.status === "RESULTADO_INDETERMINADO") await step(repo, job, "CONCILIACAO_OFICIAL", "Conciliando com o registro de tentativas.");
        await step(repo, job, "AUTORIZADA", "Já autorizada em tentativa anterior; nada foi reenviado.");
        summary.authorized++;
        continue;
      }
      const known = await provider.getSubmissionStatus(job.idempotencyKey);
      let outcome: SubmissionOutcome;
      if (known && known.status !== "RESULTADO_INDETERMINADO") {
        outcome = known;
      } else {
        const reason = job.status === "CONCILIACAO_OFICIAL" ? "Consulta sem resultado; reenvio com a MESMA chave." : "";
        if (reason && !(await repo.transition(job, job.status, job.status, reason))) { summary.skipped++; continue; }
        outcome = await provider.submitAuthorizedDocument({ tenantId: job.tenantId, idempotencyKey: job.idempotencyKey, draft: job.draft });
      }
      await repo.recordAttempt(job, outcome);

      if (outcome.status === "RESULTADO_INDETERMINADO") {
        if (job.status === "ENVIANDO") await step(repo, job, "RESULTADO_INDETERMINADO", "Envio sem resposta conclusiva.");
        if (job.status === "RESULTADO_INDETERMINADO") await step(repo, job, "CONCILIACAO_OFICIAL", "Consultando o resultado antes de qualquer reenvio.");
        const after = await provider.getSubmissionStatus(job.idempotencyKey);
        if (after && after.status !== "RESULTADO_INDETERMINADO") {
          await repo.recordAttempt(job, after);
          await finalize(repo, job, after, summary);
        } else {
          await retryOrStop(repo, job, now, "Resultado indeterminado após consulta.", summary);
        }
        continue;
      }
      await finalize(repo, job, outcome, summary);
    } catch (error) {
      // Falha do conector: o resultado é desconhecido, nunca "rejeitada".
      if (job.status === "ENVIANDO") await step(repo, job, "RESULTADO_INDETERMINADO", "Falha de comunicação com o conector.");
      if (job.status === "RESULTADO_INDETERMINADO") await step(repo, job, "CONCILIACAO_OFICIAL", "Aguardando nova consulta.");
      await retryOrStop(repo, job, now, error instanceof Error ? error.message.slice(0, 300) : "erro desconhecido", summary);
    }
  }
  return summary;
}
