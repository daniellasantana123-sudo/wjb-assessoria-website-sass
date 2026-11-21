"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { toIsoDate } from "@/lib/reports/period";
import { isEntitlementEnforced } from "@/lib/commercial/config";
import { canConsume } from "@/lib/commercial/pricing";
import { getTenantCommercial, hasEntitlement } from "@/lib/commercial/repo";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { nfseBodyFromForm } from "@/lib/wjb-ai/fiscal/form";
import { previewFiscalDraft } from "@/lib/wjb-ai/fiscal/preview";
import {
  correctFiscalRequest,
  submitFiscalRequest,
} from "@/lib/wjb-ai/fiscal/requests";
import {
  createSupabaseCorrectionRepo,
  createSupabaseFiscalRepo,
} from "@/lib/wjb-ai/fiscal/requests.repo";

export interface NfseFormState {
  error?: string;
  fields?: { field: string; message: string }[];
  preview?: {
    serviceDescription: string;
    amountCents: number;
    competence: string;
    taker: { name: string; documentKind: string; documentMasked: string };
    decision: string;
    reasons: { code: string; message: string }[];
  };
}

export async function previewNfseAction(
  _prev: NfseFormState | undefined,
  formData: FormData,
): Promise<NfseFormState> {
  if (!isWjbAiEnabled()) return { error: "Recurso indisponível." };
  const session = await requireSession();
  if (isRateLimited(`wjb-ai:preview:${session.userId}`))
    return { error: "Muitas tentativas. Aguarde um minuto." };
  const tenant = session.isWjbStaff
    ? null
    : await getActiveTenant(session.userId);
  if (tenant && tenant.id !== String(formData.get("expectedTenantId"))) {
    return { error: "A empresa ativa mudou. Recarregue a página." };
  }
  const repo = createSupabaseFiscalRepo();
  const result = await previewFiscalDraft({
    moduleEnabled: true,
    session,
    tenant,
    body: nfseBodyFromForm(formData),
    today: toIsoDate(new Date()),
    loadFiscalProfile: repo.loadApprovedProfile,
    loadAuthorizationGrant: repo.loadActiveGrant,
  });
  const body = result.body as Record<string, unknown>;
  if (result.status !== 200) {
    return {
      error:
        result.status === 422
          ? "Confira os campos destacados."
          : "Não foi possível gerar a prévia.",
      fields: body.missingOrInvalid as NfseFormState["fields"],
    };
  }
  const preview = body.preview as Omit<
    NonNullable<NfseFormState["preview"]>,
    "decision" | "reasons"
  >;
  const policy = body.policy as {
    decision: string;
    reasons: { code: string; message: string }[];
  };
  return {
    preview: { ...preview, decision: policy.decision, reasons: policy.reasons },
  };
}

export async function submitNfseAction(
  _prev: NfseFormState | undefined,
  formData: FormData,
): Promise<NfseFormState> {
  if (!isWjbAiEnabled()) return { error: "Recurso indisponível." };
  const session = await requireSession();
  if (isRateLimited(`wjb-ai:submit:${session.userId}`))
    return { error: "Muitas tentativas. Aguarde um minuto." };
  const tenant = session.isWjbStaff
    ? null
    : await getActiveTenant(session.userId);
  // Fase 8: com a exigência ligada, pedir NFS-e depende de plano ativo e de
  // franquia/excedente autorizado. Decisão no servidor, nunca na tela.
  if (tenant && isEntitlementEnforced()) {
    const blocked = await entitlementBlock(tenant.id);
    if (blocked) return { error: blocked };
  }
  const result = await submitFiscalRequest({
    session,
    tenant,
    expectedTenantId: String(formData.get("expectedTenantId") ?? ""),
    body: nfseBodyFromForm(formData),
    today: toIsoDate(new Date()),
    repo: createSupabaseFiscalRepo(),
  });
  if (!result.ok) return { error: result.error, fields: result.fields };
  redirect(
    `/portal/nfse/${result.requestId}${result.duplicate ? "?duplicada=1" : ""}`,
  );
}

/** Correção de um pedido devolvido (DADOS_PENDENTES), mantendo o histórico. */
export async function correctNfseAction(
  requestId: string,
  _prev: NfseFormState | undefined,
  formData: FormData,
): Promise<NfseFormState> {
  if (!isWjbAiEnabled()) return { error: "Recurso indisponível." };
  const session = await requireSession();
  if (isRateLimited(`wjb-ai:submit:${session.userId}`))
    return { error: "Muitas tentativas. Aguarde um minuto." };
  const tenant = session.isWjbStaff
    ? null
    : await getActiveTenant(session.userId);
  const result = await correctFiscalRequest({
    session,
    tenant,
    expectedTenantId: String(formData.get("expectedTenantId") ?? ""),
    requestId,
    body: nfseBodyFromForm(formData),
    today: toIsoDate(new Date()),
    repo: createSupabaseCorrectionRepo(),
  });
  if (!result.ok) return { error: result.error, fields: result.fields };
  redirect(`/portal/nfse/${requestId}?corrigida=1`);
}

async function entitlementBlock(tenantId: string): Promise<string | null> {
  if (!(await hasEntitlement(tenantId, "nfse")))
    return "Sua empresa não tem um plano de emissão ativo. Veja em Portal > Plano.";
  const c = await getTenantCommercial(tenantId);
  const d = canConsume(c.subscription, c.usedSimulated + c.usedBillable);
  if (d.allowed) return null;
  return {
    sem_assinatura_ativa: "Sua empresa não tem um plano de emissão ativo.",
    excedente_nao_autorizado: "A franquia do mês acabou. Autorize o excedente em Portal > Plano para continuar.",
    limite_de_gasto: "O limite de gasto com excedente foi atingido. Ajuste em Portal > Plano.",
    sob_proposta: "Plano sob proposta: fale com a equipe comercial.",
  }[d.reason];
}
