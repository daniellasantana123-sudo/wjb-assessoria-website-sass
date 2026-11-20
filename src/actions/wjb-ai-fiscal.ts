"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { toIsoDate } from "@/lib/reports/period";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { nfseBodyFromForm } from "@/lib/wjb-ai/fiscal/form";
import { previewFiscalDraft } from "@/lib/wjb-ai/fiscal/preview";
import { submitFiscalRequest } from "@/lib/wjb-ai/fiscal/requests";
import { createSupabaseFiscalRepo } from "@/lib/wjb-ai/fiscal/requests.repo";

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
