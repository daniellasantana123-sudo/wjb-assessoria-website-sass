"use client";

import { useActionState, type ReactNode } from "react";

import type { AdminActionState } from "@/actions/wjb-ai-admin";
import { Button } from "@/components/ui/button";

/**
 * Formulário genérico das ações do Admin do WJB AI: mostra o retorno da
 * Server Action (erro ou confirmação) ao lado do botão. Os campos vêm como
 * `children` renderizados no servidor.
 */
export function AdminActionForm({
  action,
  submitLabel,
  pendingLabel = "Salvando...",
  variant = "primary",
  children,
}: {
  action: (prev: AdminActionState | undefined, formData: FormData) => Promise<AdminActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "cta";
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {state?.error ? <p role="alert" className="text-danger text-sm">{state.error}</p> : null}
        {state?.ok ? <p role="status" className="text-success text-sm">{state.ok}</p> : null}
      </div>
    </form>
  );
}
