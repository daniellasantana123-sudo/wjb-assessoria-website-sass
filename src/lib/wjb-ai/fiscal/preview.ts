import type { Session } from "@/lib/auth/dal";
import { SIMULATION_LABEL } from "@/lib/wjb-ai/fiscal/labels";
import type { MyOrganization } from "@/lib/tenant";
import { parseNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { buildIdempotencyKey } from "@/lib/wjb-ai/fiscal/idempotency";
import {
  POLICY_REASON_LABELS,
  evaluatePolicy,
  type ApprovedFiscalProfile,
  type AuthorizationGrant,
} from "@/lib/wjb-ai/fiscal/policy";
import { hasWjbAiPermission } from "@/lib/wjb-ai/permissions";

/**
 * Prévia de NFS-e (F1): valida, calcula a decisão de política e a chave de
 * idempotência. NÃO grava nada, NÃO transmite nada e NÃO chama IA.
 *
 * Função pura: a rota injeta sessão e empresa já resolvidas no servidor.
 * `tenant` vem sempre de `getActiveTenant()` - o corpo nunca escolhe empresa.
 */
export interface PreviewDeps {
  moduleEnabled: boolean;
  session: Session | null;
  tenant: MyOrganization | null;
  body: unknown;
  today: string;
  /** Perfil e autorização ainda não têm tabela (migration 0024 pendente). */
  loadFiscalProfile?: (
    tenantId: string,
  ) => Promise<ApprovedFiscalProfile | null>;
  loadAuthorizationGrant?: (
    tenantId: string,
  ) => Promise<AuthorizationGrant | null>;
  isDuplicate?: (tenantId: string, idempotencyKey: string) => Promise<boolean>;
}

export interface PreviewResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function previewFiscalDraft(
  deps: PreviewDeps,
): Promise<PreviewResponse> {
  if (!deps.moduleEnabled)
    return { status: 404, body: { ok: false, error: "not_found" } };
  if (!deps.session)
    return { status: 401, body: { ok: false, error: "unauthenticated" } };
  if (deps.session.isWjbStaff) {
    // Equipe atua por empresa em fluxo próprio (revisão), a criar na F3.
    return {
      status: 403,
      body: { ok: false, error: "staff_use_review_queue" },
    };
  }
  if (!deps.tenant)
    return { status: 403, body: { ok: false, error: "no_active_company" } };
  if (
    !hasWjbAiPermission(deps.session, "fiscal.draft.create", deps.tenant.role)
  ) {
    return { status: 403, body: { ok: false, error: "forbidden" } };
  }

  const parsed = parseNfseDraft(deps.body);
  if (!parsed.ok) {
    return {
      status: 422,
      body: {
        ok: false,
        error: "invalid_draft",
        missingOrInvalid: parsed.missingOrInvalid,
      },
    };
  }

  const tenantId = deps.tenant.id;
  const idempotencyKey = buildIdempotencyKey(tenantId, parsed.draft);
  const [fiscalProfile, authorizationGrant, duplicateSuspected] =
    await Promise.all([
      deps.loadFiscalProfile?.(tenantId) ?? Promise.resolve(null),
      deps.loadAuthorizationGrant?.(tenantId) ?? Promise.resolve(null),
      deps.isDuplicate?.(tenantId, idempotencyKey) ?? Promise.resolve(false),
    ]);

  const policy = evaluatePolicy({
    moduleEnabled: true,
    draft: parsed.draft,
    fiscalProfile,
    authorizationGrant,
    duplicateSuspected,
    today: deps.today,
  });

  return {
    status: 200,
    body: {
      ok: true,
      simulated: true,
      transmitted: false,
      fiscalValue: false,
      notice: SIMULATION_LABEL,
      // Nunca devolver o CPF/CNPJ completo do tomador: a tela já o tem.
      preview: {
        serviceDescription: parsed.draft.serviceDescription,
        amountCents: parsed.draft.amountCents,
        competence: parsed.draft.competence,
        taker: {
          name: parsed.draft.taker.name,
          documentKind: parsed.draft.taker.documentKind,
          documentMasked: `***${parsed.draft.taker.document.slice(-4)}`,
        },
      },
      policy: {
        decision: policy.decision,
        reasons: policy.reasons.map((code) => ({
          code,
          message: POLICY_REASON_LABELS[code],
        })),
      },
      idempotencyKey,
    },
  };
}
