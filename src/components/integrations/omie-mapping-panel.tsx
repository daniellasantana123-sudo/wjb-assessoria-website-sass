"use client";

import { useActionState, useState, useTransition } from "react";

import {
  saveOmieMapping,
  setOmieMappingDisabled,
  syncOmieClient,
  type OmieActionState,
} from "@/actions/omie-gclick";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OmieStatusBadge } from "@/components/integrations/omie-status-badge";
import type { OmieMapping } from "@/lib/omie-gclick";

/**
 * Painel de staff (Admin WJB > Empresas > [id]) pra configurar o
 * mapeamento Omie.G-Click de um tenant — Fase 4 do wjb-saas-mvp. Só quem
 * tem `integrations.manage` chega aqui (verificado de novo no servidor
 * pelas Server Actions; esta prop só evita renderizar controles pra quem
 * não pode usá-los, mesmo padrão de `canManage` em `MembersList`).
 */
export function OmieMappingPanel({
  tenantId,
  mapping,
}: {
  tenantId: string;
  mapping: OmieMapping | null;
}) {
  const saveMappingForTenant = saveOmieMapping.bind(null, tenantId);
  const [saveState, saveAction, savePending] = useActionState(saveMappingForTenant, undefined);
  const [syncPending, startSyncTransition] = useTransition();
  const [syncResult, setSyncResult] = useState<OmieActionState>(undefined);
  const [disablePending, startDisableTransition] = useTransition();

  const status = mapping?.status ?? "not_connected";
  const isDisabled = status === "disabled";

  function handleSync() {
    startSyncTransition(async () => {
      const result = await syncOmieClient(tenantId);
      setSyncResult(result);
    });
  }

  function handleToggleDisabled() {
    startDisableTransition(async () => {
      await setOmieMappingDisabled(tenantId, !isDisabled);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <OmieStatusBadge status={status} />
        {mapping?.lastSyncedAt && (
          <span className="text-muted-foreground text-xs">
            Última sincronização: {new Date(mapping.lastSyncedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      {mapping?.lastError && status === "error" && (
        <p className="text-danger text-sm">Último erro: {mapping.lastError}</p>
      )}

      <form action={saveAction} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalClientId">Código do cliente no Omie</Label>
          <Input
            id="externalClientId"
            name="externalClientId"
            defaultValue={mapping?.externalClientId ?? ""}
            placeholder="Ex.: 123456789"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalPortalUrl">Link do Portal Contábil (Visão do Cliente)</Label>
          <Input
            id="externalPortalUrl"
            name="externalPortalUrl"
            type="url"
            defaultValue={mapping?.externalPortalUrl ?? ""}
            placeholder="https://..."
          />
        </div>

        {saveState && "error" in saveState && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {saveState.error}
          </p>
        )}
        {saveState && "success" in saveState && (
          <p role="status" className="text-brand-green-700 text-sm sm:col-span-2">
            {saveState.success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="outline" disabled={savePending}>
            {savePending ? "Salvando..." : "Salvar mapeamento"}
          </Button>
          <Button type="button" onClick={handleSync} disabled={syncPending || isDisabled}>
            {syncPending ? "Sincronizando..." : "Sincronizar com o Omie.G-Click"}
          </Button>
          <Button type="button" variant="ghost" onClick={handleToggleDisabled} disabled={disablePending}>
            {isDisabled ? "Reativar integração" : "Desativar integração"}
          </Button>
        </div>
      </form>

      {syncResult && "error" in syncResult && syncResult.error && (
        <p role="alert" className="text-danger text-sm">
          {syncResult.error}
        </p>
      )}
      {syncResult && "success" in syncResult && syncResult.success && (
        <p role="status" className="text-brand-green-700 text-sm">
          {syncResult.success}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        A sincronização automática depende de <code>OMIE_APP_KEY</code>/<code>OMIE_APP_SECRET</code>{" "}
        configuradas no servidor — sem isso, fica registrado como erro (esperado, não é bug).
      </p>
    </div>
  );
}
