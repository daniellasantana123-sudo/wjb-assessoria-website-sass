"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { importGClickClients, type ImportGClickState } from "@/actions/omie-gclick";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientMatches, formatDocument } from "@/lib/integrations/client-search";
import { cn } from "@/lib/utils";

export interface GClickImportRow {
  externalId: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  /** linked: já vinculado | same_document: empresa da plataforma com o mesmo CNPJ, sem vínculo | new: não existe na plataforma */
  state: "linked" | "same_document" | "new";
  tenantId: string | null;
}

type Filter = "pending" | "linked" | "all";

const filters: { value: Filter; label: string }[] = [
  { value: "pending", label: "Ainda não importados" },
  { value: "linked", label: "Já na plataforma" },
  { value: "all", label: "Todos" },
];

/**
 * Lista de clientes do G-Click com busca e seleção para importar
 * (2026-10-01). A busca roda aqui, sobre a lista já carregada: razão
 * social, nome fantasia ou CNPJ, sem diferenciar maiúscula nem acento.
 */
export function GClickImportList({ rows, initialQuery = "" }: { rows: GClickImportRow[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportGClickState | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (filter === "pending" && row.state === "linked") return false;
        if (filter === "linked" && row.state !== "linked") return false;
        return query.trim().length < 2 || clientMatches(row, query);
      }),
    [rows, filter, query],
  );
  const selectable = visible.filter((row) => row.state !== "linked");
  const allVisibleSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.externalId));
  const pendingCount = rows.filter((row) => row.state !== "linked").length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of selectable) {
        if (allVisibleSelected) next.delete(row.externalId);
        else next.add(row.externalId);
      }
      return next;
    });
  }

  function handleImport() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Importar ${ids.length} cliente(s) do G-Click para a plataforma? Cada um vira uma empresa já vinculada ao G-Click. Nada é alterado no G-Click.`,
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => {
      const response = await importGClickClients(ids);
      setResult(response);
      if ("success" in response) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <Label htmlFor="gclick-import-search">Buscar por razão social, nome fantasia ou CNPJ</Label>
          <Input
            id="gclick-import-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: pimpolha, 12.345.678/0001-99"
            autoComplete="off"
          />
        </div>
        <div role="group" aria-label="Filtrar lista" className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "focus-visible:ring-primary min-h-10 rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                filter === option.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
        <p className="text-muted-foreground text-sm">
          {rows.length} clientes no G-Click · {pendingCount} ainda não importados · {visible.length} na lista
          {selected.size > 0 && (
            <>
              {" · "}
              <strong className="text-foreground">{selected.size} selecionado(s)</strong>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {selectable.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={toggleAllVisible}>
              {allVisibleSelected ? "Desmarcar os da lista" : `Selecionar os da lista (${selectable.length})`}
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleImport} disabled={pending || selected.size === 0}>
            {pending ? "Importando..." : `Importar selecionados${selected.size ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </div>

      {result && "success" in result && (
        <p role="status" className="text-success-text bg-success-bg rounded-md p-3 text-sm">
          {result.success}
        </p>
      )}
      {result && "error" in result && (
        <p role="alert" className="text-danger rounded-md p-3 text-sm">
          {result.error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border p-6 text-center text-sm">
          Nenhum cliente do G-Click combina com essa busca e esse filtro.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {visible.map((row) => {
            const checkboxId = `gclick-${row.externalId}`;
            return (
              <li key={row.externalId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                {/* Caixa e nome sempre na mesma linha; só a etiqueta desce em telas estreitas. */}
                <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
                  {row.state === "linked" ? (
                    <span aria-hidden="true" className="w-6 shrink-0" />
                  ) : (
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selected.has(row.externalId)}
                      onChange={() => toggle(row.externalId)}
                      className="accent-primary mt-0.5 h-6 w-6 shrink-0"
                    />
                  )}
                  <label htmlFor={row.state === "linked" ? undefined : checkboxId} className="min-w-0 flex-1">
                    <span className="text-foreground block font-medium break-words">{row.tradeName ?? row.name}</span>
                    {row.tradeName && (
                      <span className="text-muted-foreground block text-sm break-words">Razão social: {row.name}</span>
                    )}
                    <span className="text-muted-foreground block text-xs">
                      {formatDocument(row.document) ?? "sem CNPJ cadastrado"} · id {row.externalId}
                    </span>
                  </label>
                </div>
                {row.state === "linked" && row.tenantId ? (
                  <Link
                    href={`/admin/empresas/${row.tenantId}`}
                    className="text-primary text-sm font-medium underline underline-offset-4"
                  >
                    Já na plataforma →
                  </Link>
                ) : row.state === "same_document" ? (
                  <Badge tone="warning">Mesmo CNPJ já cadastrado: só vincula</Badge>
                ) : (
                  <Badge tone="info">Novo</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
