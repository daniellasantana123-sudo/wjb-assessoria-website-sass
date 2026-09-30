"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

type ActionResult = { success: string } | { error: string } | void | undefined;

/**
 * Botão-link para ações de Admin/Portal que rodam uma Server Action
 * (suspender, revogar, apagar, reenviar convite...).
 *
 * Existe por dois problemas reais (revisão de 2026-09-30):
 * - ações destrutivas rodavam com um toque, sem confirmação - no celular,
 *   um toque por engano apagava um documento ou cortava o acesso de alguém;
 * - o resultado da action (`{ success }`/`{ error }`) era descartado, então
 *   "Reenviar convite" não dava retorno nenhum.
 * `confirmMessage` liga a confirmação; a mensagem devolvida aparece ao lado.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  tone = "muted",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
  tone?: "muted" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>(undefined);

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setResult(undefined);
    startTransition(async () => {
      setResult(await action());
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "focus-visible:ring-primary min-h-9 rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60",
          tone === "danger"
            ? "text-danger hover:text-danger"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {pending ? (pendingLabel ?? "Aguarde...") : label}
      </button>
      {result && "success" in result ? (
        <span role="status" className="text-success-text text-xs">
          {result.success}
        </span>
      ) : null}
      {result && "error" in result ? (
        <span role="alert" className="text-danger text-xs">
          {result.error}
        </span>
      ) : null}
    </span>
  );
}
