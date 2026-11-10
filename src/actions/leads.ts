"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import type { LeadStatus } from "@/types/database";

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  // `status_changed_at` vem da migration 0023; sem ela, atualiza só o status.
  const { error } = await supabase
    .from("leads")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    await supabase.from("leads").update({ status }).eq("id", leadId);
  }

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "lead.status_changed",
    entity: "lead",
    entity_id: leadId,
    metadata: { status },
  });

  revalidatePath("/admin/leads");
}
