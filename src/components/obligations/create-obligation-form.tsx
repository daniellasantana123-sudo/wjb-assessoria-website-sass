"use client";

import { useActionState, useRef } from "react";

import { createObligation } from "@/actions/obligations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateObligationForm({ tenantId }: { tenantId: string }) {
  const createForTenant = createObligation.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(createForTenant, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" placeholder="Ex.: DAS Simples Nacional" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Vencimento</Label>
          <Input id="dueDate" name="dueDate" type="date" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Observação (opcional)</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adicionando..." : "Adicionar obrigação"}
      </Button>
    </form>
  );
}
