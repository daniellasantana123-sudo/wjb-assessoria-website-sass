"use client";

import { useTransition } from "react";

import { setFeatureFlag } from "@/actions/feature-flags";
import { Badge } from "@/components/ui/badge";
import type { FeatureFlag } from "@/lib/feature-flags";

/**
 * Kill switches (Fase 5 do wjb-saas-mvp) - exclusivo de super_admin
 * (checado de novo no servidor por `setFeatureFlag`; esta tela só
 * aparece pra quem já tem `feature_flags.manage`, ver página que a
 * renderiza).
 */
export function FeatureFlagsPanel({
  flags,
  canManage = true,
}: {
  flags: FeatureFlag[];
  canManage?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle(key: FeatureFlag["key"], enabled: boolean) {
    startTransition(async () => {
      await setFeatureFlag(key, enabled);
    });
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {flags.map((flag) => (
        <div key={flag.key} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-foreground font-medium">{flag.label}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={flag.enabled ? "success" : "danger"}>
                {flag.enabled ? "Ativa" : "Desativada"}
              </Badge>
              {flag.updatedAt && (
                <span className="text-muted-foreground text-xs">
                  Atualizada em {new Date(flag.updatedAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleToggle(flag.key, !flag.enabled)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary shrink-0 rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {flag.enabled ? "Desativar" : "Ativar"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
