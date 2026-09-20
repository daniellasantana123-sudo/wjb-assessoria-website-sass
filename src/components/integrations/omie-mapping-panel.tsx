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
import type { ProviderMode } from "@/integrations/omie-gclick";

/**
 * Painel de staff (Admin WJB > Empresas > [id]) pra configurar o
 * mapeamento Omie.G-Click de um tenant — Fase 4 do wjb-saas-mvp. Só quem
 * tem `integrations.manage` chega aqui (verificado de novo no servidor
 * pelas Server Actions; esta prop só evita renderizar controles pra quem
 * não pode usá-los, mesmo padrão de `canManage` em `MembersList`).
 *
 * "Sincronizar com o Omie.G-Click" (Fase 6.5 - "mocks e contratos
 * internos"): em modo mock (padrão, `GCLICK_MODE` ausente), o botão
 * simula uma sincronização em memória com sucesso - nunca uma
 * sincronização real. Em modo sandbox/production, continua sempre
 * bloqueado (nenhuma implementação real existe - ver
 * `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md`). `mode` vem do
 * servidor (`getGClickConfig()`) pra nunca deixar a UI apresentar um
 * resultado simulado como se fosse "Conectado" de verdade.
 */
export function OmieMappingPanel({
  tenantId,
  mapping,
  mode,
}: {
  tenantId: string;
  mapping: OmieMapping | null;
  mode: ProviderMode;
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
        <OmieStatusBadge status={status} mode={mode} />
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
        {mode === "mock"
          ? "Modo mock (ambiente de desenvolvimento) - toda sincronização aqui é simulada em memória, nenhum dado real é enviado ao G-Click. Integração real: não habilitada."
          : "A sincronização real está bloqueada - a documentação técnica oficial da API do G-Click precisa ser confirmada antes de implementar a chamada real (ver auditoria técnica da Fase 6.5)."}
      </p>
    </div>
  );
}
