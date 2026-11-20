import type { Session } from "@/lib/auth/dal";
import type { MyOrganization } from "@/lib/tenant";
import {
  parseNfseDraft,
  type NormalizedNfseDraft,
} from "@/lib/wjb-ai/fiscal/draft";
import { buildIdempotencyKey } from "@/lib/wjb-ai/fiscal/idempotency";
import {
  evaluatePolicy,
  type ApprovedFiscalProfile,
  type AuthorizationGrant,
  type PolicyDecision,
  type PolicyReason,
} from "@/lib/wjb-ai/fiscal/policy";
import {
  assertTransition,
  type FiscalStatus,
} from "@/lib/wjb-ai/fiscal/status";
import { hasWjbAiPermission } from "@/lib/wjb-ai/permissions";

/**
 * Registro da solicitação de NFS-e (F2 do plano aprovado em 20/11/2026).
 * Grava o pedido, aplica a política e registra cada mudança de estado como
 * evento. NÃO transmite nada: o envio é da fila (fase seguinte), só com o
 * conector simulado.
 *
 * Lógica pura com repositório injetado, para testar sem banco. A
 * implementação real está em `requests.repo.ts`.
 */

export interface TransitionStep {
  from: FiscalStatus;
  to: FiscalStatus;
  reason: string;
}

/** Caminho inicial de um pedido recém-recebido até o estado de decisão. */
export function planInitialPath(decision: PolicyDecision): TransitionStep[] {
  const steps: TransitionStep[] = [
    {
      from: "RECEBIDA",
      to: "TRIAGEM",
      reason: "Pedido recebido pela Área do Cliente.",
    },
    {
      from: "TRIAGEM",
      to: "VALIDACAO_FISCAL",
      reason: "Dados obrigatórios completos.",
    },
  ];
  if (decision === "BLOCKED") {
    steps.push({
      from: "VALIDACAO_FISCAL",
      to: "BLOQUEADA",
      reason: "Bloqueado pela política.",
    });
  } else if (decision === "HUMAN_REVIEW") {
    steps.push({
      from: "VALIDACAO_FISCAL",
      to: "REVISAO_HUMANA",
      reason: "Encaminhado para revisão do contador.",
    });
  } else {
    steps.push(
      {
        from: "VALIDACAO_FISCAL",
        to: "PRONTA_PARA_CONFIRMACAO",
        reason: "Validação concluída.",
      },
      {
        from: "PRONTA_PARA_CONFIRMACAO",
        to: "CONFIRMADA",
        reason: "Cliente conferiu a prévia e confirmou.",
      },
    );
  }
  // Garante que o plano nunca contém um salto inválido.
  for (const step of steps) assertTransition(step.from, step.to);
  return steps;
}

export interface FiscalRequestRepo {
  /** Insere em RECEBIDA com o cliente do usuário (RLS). */
  insertRequest(row: {
    tenantId: string;
    createdBy: string;
    idempotencyKey: string;
    draft: NormalizedNfseDraft;
    draftHash: string;
  }): Promise<{ id: string } | { duplicateOfId: string } | { error: string }>;
  loadApprovedProfile(tenantId: string): Promise<ApprovedFiscalProfile | null>;
  loadActiveGrant(tenantId: string): Promise<AuthorizationGrant | null>;
  /** Aplica os passos e grava os eventos (servidor/service role). */
  applyTransitions(input: {
    requestId: string;
    tenantId: string;
    actorId: string;
    steps: TransitionStep[];
    decision: PolicyDecision;
    reasons: PolicyReason[];
  }): Promise<boolean>;
  audit(input: {
    actorId: string;
    tenantId: string;
    requestId: string;
    status: FiscalStatus;
  }): Promise<void>;
}

export type SubmitResult =
  | { ok: true; requestId: string; status: FiscalStatus; duplicate: boolean }
  | { ok: false; error: string; fields?: { field: string; message: string }[] };

export async function submitFiscalRequest(input: {
  session: Session;
  tenant: MyOrganization | null;
  /** Empresa exibida na tela; se a empresa ativa mudou, o pedido é recusado. */
  expectedTenantId: string;
  body: unknown;
  today: string;
  repo: FiscalRequestRepo;
}): Promise<SubmitResult> {
  const { session, tenant, repo } = input;
  if (session.isWjbStaff)
    return {
      ok: false,
      error: "A equipe WJB não abre solicitações pelo Portal.",
    };
  if (!tenant) return { ok: false, error: "Nenhuma empresa ativa." };
  if (tenant.id !== input.expectedTenantId) {
    return {
      ok: false,
      error: "A empresa ativa mudou. Recarregue a página e confira os dados.",
    };
  }
  if (!hasWjbAiPermission(session, "fiscal.draft.create", tenant.role)) {
    return {
      ok: false,
      error: "Sem permissão para solicitar NFS-e nesta empresa.",
    };
  }

  const parsed = parseNfseDraft(input.body);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fields: parsed.missingOrInvalid,
    };
  }

  const idempotencyKey = buildIdempotencyKey(tenant.id, parsed.draft);
  const inserted = await repo.insertRequest({
    tenantId: tenant.id,
    createdBy: session.userId,
    idempotencyKey,
    draft: parsed.draft,
    draftHash: idempotencyKey,
  });
  if ("error" in inserted) return { ok: false, error: inserted.error };
  if ("duplicateOfId" in inserted) {
    // Mesmo pedido enviado de novo: devolve o que já existe, sem criar outro.
    return {
      ok: true,
      requestId: inserted.duplicateOfId,
      status: "RECEBIDA",
      duplicate: true,
    };
  }

  const [fiscalProfile, authorizationGrant] = await Promise.all([
    repo.loadApprovedProfile(tenant.id),
    repo.loadActiveGrant(tenant.id),
  ]);
  const policy = evaluatePolicy({
    moduleEnabled: true,
    draft: parsed.draft,
    fiscalProfile,
    authorizationGrant,
    duplicateSuspected: false,
    today: input.today,
  });
  const steps = planInitialPath(policy.decision);
  const applied = await repo.applyTransitions({
    requestId: inserted.id,
    tenantId: tenant.id,
    actorId: session.userId,
    steps,
    decision: policy.decision,
    reasons: policy.reasons,
  });
  const finalStatus: FiscalStatus = applied
    ? steps[steps.length - 1].to
    : "RECEBIDA";
  await repo.audit({
    actorId: session.userId,
    tenantId: tenant.id,
    requestId: inserted.id,
    status: finalStatus,
  });

  return {
    ok: true,
    requestId: inserted.id,
    status: finalStatus,
    duplicate: false,
  };
}
