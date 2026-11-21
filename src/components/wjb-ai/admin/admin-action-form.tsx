"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

import type { AdminActionState } from "@/actions/wjb-ai-admin";
import { Button } from "@/components/ui/button";

/**
 * Formulário genérico das ações do Admin do WJB AI: mostra o retorno da
 * Server Action (erro ou confirmação) ao lado do botão. Os campos vêm como
 * `children` renderizados no servidor.
 *
 * Envio manual (onSubmit + startTransition) em vez de `action={...}`: com
 * `action`, o React 19 limpa os campos ao terminar MESMO quando a ação
 * devolve erro, e o contador perdia o cadastro fiscal inteiro por causa de um
 * campo (achado no E2E com login real, Fase 5). Agora só limpa no sucesso.
 */
export function AdminActionForm({
  action,
  submitLabel,
  pendingLabel = "Salvando...",
  variant = "primary",
  resetOnSuccess = true,
  children,
}: {
  action: (
    prev: AdminActionState | undefined,
    formData: FormData,
  ) => Promise<AdminActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "cta";
  resetOnSuccess?: boolean;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {state?.error ? (
          <p role="alert" className="text-danger text-sm">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-success-text text-sm">
            {state.ok}
          </p>
        ) : null}
      </div>
    </form>
  );
}
