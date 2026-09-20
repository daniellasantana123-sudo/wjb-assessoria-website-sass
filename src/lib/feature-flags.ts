import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/db/supabase/server";
import type { FeatureFlagKey } from "@/types/database";

/**
 * Só as keys com um ponto de chamada real (ver `decisions.md` da Fase 5)
 * - `uploadDocument` (documents), `notifyTicketOrMessageEvent`
 * (notifications), `syncOmieClient`/`OmiePortalCta` (omie_gclick). Criar
 * uma flag sem checagem em lugar nenhum seria um toggle decorativo.
 */
export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  omie_gclick: "Integração Omie.G-Click",
  documents: "Upload de documentos",
  notifications: "Notificações (in-app e e-mail)",
};

export interface FeatureFlag {
  key: FeatureFlagKey;
  label: string;
  enabled: boolean;
  updatedAt: string | null;
}

/**
 * Memoizado por request (`cache()`) - várias checagens da mesma flag numa
 * única renderização/Server Action disparam só uma consulta. Linha ausente
 * (nunca deveria acontecer, a migration semeia as 3) cai em `true` -
 * mesmo espírito de "nunca quebrar quem chamou" dos adapters no-op: uma
 * falha aqui não deveria desligar uma feature sozinha.
 */
export const isFeatureEnabled = cache(async (key: FeatureFlagKey): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();

  return data?.enabled ?? true;
});

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("feature_flags").select("key, enabled, updated_at");

  const byKey = new Map((data ?? []).map((row) => [row.key, row]));

  return (Object.keys(FEATURE_FLAG_LABELS) as FeatureFlagKey[]).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      label: FEATURE_FLAG_LABELS[key],
      enabled: row?.enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    };
  });
}
