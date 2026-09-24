"use client";

import { useActionState, useState, useTransition } from "react";

import {
  saveOmieMapping,
  searchGClickClients,
  setOmieMappingDisabled,
  syncOmieClient,
  syncOmieObligations,
  type GClickClientOption,
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
  tenantDocument,
  mapping,
  mode,
}: {
  tenantId: string;
  /** CNPJ da empresa - pré-preenche a busca, que é o caso mais comum. */
  tenantDocument: string | null;
  mapping: OmieMapping | null;
  mode: ProviderMode;
}) {
  const saveMappingForTenant = saveOmieMapping.bind(null, tenantId);
  const [saveState, saveAction, savePending] = useActionState(saveMappingForTenant, undefined);
  const [syncPending, startSyncTransition] = useTransition();
  const [syncResult, setSyncResult] = useState<OmieActionState>(undefined);
  const [obligationsPending, startObligationsTransition] = useTransition();
  const [disablePending, startDisableTransition] = useTransition();

  const [clientId, setClientId] = useState(mapping?.externalClientId ?? "");
  const [query, setQuery] = useState(tenantDocument ?? "");
  const [results, setResults] = useState<GClickClientOption[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPending, startSearchTransition] = useTransition();

  const status = mapping?.status ?? "not_connected";
  const isDisabled = status === "disabled";
  // Sem cliente vinculado não há de quem puxar tarefa - o botão fica
  // inativo em vez de aparecer e falhar com mensagem de erro.
  // Usa o valor SALVO, não o digitado: sincronizar antes de salvar leria
  // um id que o servidor ainda não conhece.
  const canSyncObligations = Boolean(mapping?.externalClientId) && !isDisabled;

  function handleSearch() {
    setSearchError(null);
    startSearchTransition(async () => {
      const result = await searchGClickClients(query);
      if ("error" in result) {
        setResults(null);
        setSearchError(result.error);
        return;
      }
      setResults(result.results);
    });
  }

  function handleSync() {
    startSyncTransition(async () => {
      const result = await syncOmieClient(tenantId);
      setSyncResult(result);
    });
  }

  function handleSyncObligations() {
    startObligationsTransition(async () => {
      const result = await syncOmieObligations(tenantId);
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

      <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gclickSearch">Procurar a empresa no G-Click</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="gclickSearch"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Enter dentro de um campo de busca é o reflexo natural -
                // mas este campo vive ao lado de um formulário, então o
                // padrão precisa ser impedido para não salvar sem querer.
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="CNPJ ou nome da empresa"
              className="min-w-[16rem] flex-1"
            />
            <Button type="button" variant="outline" onClick={handleSearch} disabled={searchPending}>
              {searchPending ? "Procurando..." : "Procurar"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Pode digitar o CNPJ com ponto e barra - a pontuação é removida antes da busca.
          </p>
        </div>

        {searchError && (
          <p role="alert" className="text-danger text-sm">
            {searchError}
          </p>
        )}

        {results !== null &&
          (results.length === 0 ? (
            <p role="status" className="text-muted-foreground text-sm">
              Nenhum cliente encontrado no G-Click com esse CNPJ ou nome. Confira o dado ou
              cadastre a empresa lá primeiro.
            </p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-md border">
              {results.map((option) => (
                <li key={option.externalId}>
                  <button
                    type="button"
                    onClick={() => setClientId(option.externalId)}
                    className="hover:bg-muted/50 focus-visible:ring-primary flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm font-medium">
                        {option.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {option.document ?? "sem CNPJ cadastrado"} · id {option.externalId}
                      </span>
                    </span>
                    <span className="text-primary shrink-0 text-xs font-medium">
                      {clientId === option.externalId ? "Selecionada" : "Selecionar"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>

      <form action={saveAction} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalClientId">ID do cliente no G-Click</Label>
          <Input
            id="externalClientId"
            name="externalClientId"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Selecione acima ou digite o id"
          />
          <p className="text-muted-foreground text-xs">
            Preenchido pela busca. Ainda é possível digitar à mão, se você já souber o id.
          </p>
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
            {syncPending ? "Sincronizando..." : "Sincronizar cadastro da empresa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSyncObligations}
            disabled={obligationsPending || !canSyncObligations}
            title={
              canSyncObligations
                ? undefined
                : "Salve o ID do cliente no G-Click para liberar a sincronização de obrigações."
            }
          >
            {obligationsPending ? "Trazendo obrigações..." : "Sincronizar obrigações"}
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
          ? "Modo mock (ambiente de desenvolvimento) - toda sincronização aqui é simulada em memória, nenhum dado real é enviado ao G-Click nem lido de lá."
          : "\"Sincronizar cadastro\" envia o nome e o CNPJ da empresa para o G-Click. \"Sincronizar obrigações\" traz as tarefas daquele cliente para a plataforma, onde o cliente as vê - nada é escrito de volta no G-Click, e obrigações lançadas à mão pela WJB nunca são alteradas."}
      </p>
    </div>
  );
}
