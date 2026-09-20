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
 *
 * "Sincronizar com o Omie.G-Click" hoje sempre falha (BLOCKED_BY_PROVIDER,
 * Fase 6.5 - ver `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md`) - o
 * botão continua visível pra não esconder a funcionalidade, mas o
 * resultado é sempre um erro claro, nunca um sucesso simulado.
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
          <Label htmlFor="externalClientId">ID do cliente no G-Click</Label>
          <Input
            id="externalClientId"
            name="externalClientId"
            defaultValue={mapping?.externalClientId ?? ""}
            placeholder="Preencher quando a empresa tiver conta no G-Click"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalPortalUrl">Link do Portal Contábil (opcional)</Label>
          <Input
            id="externalPortalUrl"
            name="externalPortalUrl"
            type="url"
            defaultValue={mapping?.externalPortalUrl ?? ""}
            placeholder="Deixe em branco para usar o login padrão do G-Click"
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
        A sincronização automática ainda está bloqueada - a documentação técnica oficial da API do
        G-Click precisa ser confirmada antes de implementar a chamada real (ver auditoria técnica
        da Fase 6.5). Até lá, fica registrado como erro (esperado, não é bug).
      </p>
    </div>
  );
}
