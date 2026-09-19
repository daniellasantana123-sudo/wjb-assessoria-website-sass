"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { createObligationSchema, type CreateObligationValues } from "@/lib/validation/obligation";

export type ObligationActionState = { error: string } | undefined;

/** Obrigações são julgamento profissional da WJB — só staff cria/gerencia. */
export async function createObligation(
  tenantId: string,
  _prevState: ObligationActionState,
  formData: FormData,
): Promise<ObligationActionState> {
  const session = await requireStaffSession();

  const raw: CreateObligationValues = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
  };

  const validated = createObligationSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: obligation, error } = await supabase
    .from("obligations")
    .insert({
      tenant_id: tenantId,
      title: validated.data.title,
      description: validated.data.description || null,
      due_date: validated.data.dueDate,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error || !obligation) {
    console.error("[obligations] falha ao criar:", error);
    return { error: "Não foi possível criar a obrigação." };
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: tenantId,
    action: "obligation.created",
    entity: "obligation",
    entity_id: obligation.id,
    metadata: { title: obligation.title, due_date: obligation.due_date },
  });

  revalidatePath(`/portal/obrigacoes`);
  revalidatePath(`/admin/empresas/${tenantId}`);
  return undefined;
}

/**
 * Não recebe `tenantId` de propósito (revisão de segurança, SAAS FASE 6) —
 * usa sempre o `tenant_id` real devolvido pelo próprio update, nunca um
 * valor vindo do cliente, mesmo sendo ação exclusiva de staff (evita
 * audit_log/revalidatePath incorretos se o parâmetro for adulterado).
 */
export async function toggleObligationStatus(obligationId: string, nextStatus: "pending" | "done") {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: obligation } = await supabase
    .from("obligations")
    .update({ status: nextStatus })
    .eq("id", obligationId)
    .select("tenant_id")
    .maybeSingle();

  if (!obligation) return;

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: obligation.tenant_id,
    action: "obligation.status_changed",
    entity: "obligation",
    entity_id: obligationId,
    metadata: { status: nextStatus },
  });

  revalidatePath(`/portal/obrigacoes`);
  revalidatePath(`/admin/empresas/${obligation.tenant_id}`);
}

export async function deleteObligation(obligationId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: obligation } = await supabase
    .from("obligations")
    .delete()
    .eq("id", obligationId)
    .select("tenant_id")
    .maybeSingle();

  if (!obligation) return;

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    tenant_id: obligation.tenant_id,
    action: "obligation.deleted",
    entity: "obligation",
    entity_id: obligationId,
  });

  revalidatePath(`/portal/obrigacoes`);
  revalidatePath(`/admin/empresas/${obligation.tenant_id}`);
}
