"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/permissions/permissions";
import type { FeatureFlagKey } from "@/types/database";

/** Kill switch de feature - exclusivo de super_admin (mesmo nível de `staff.manage`). */
export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean) {
  const session = await requireStaffSession();
  if (!hasPermission(session, "feature_flags.manage")) return;

  const supabase = await createClient();
  await supabase.from("feature_flags").upsert({
    key,
    enabled,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("audit_log").insert({
    actor_id: session.userId,
    action: "feature_flag.updated",
    entity: "feature_flag",
    entity_id: key,
    metadata: { enabled },
  });

  revalidatePath("/admin/integracoes");
}
