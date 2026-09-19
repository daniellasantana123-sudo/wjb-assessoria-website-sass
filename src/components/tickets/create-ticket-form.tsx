"use client";

import { useActionState, useRef } from "react";

import { createTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateTicketForm({ tenantId }: { tenantId: string }) {
  const createForTenant = createTicket.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(createForTenant, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject">Assunto</Label>
        <Input id="subject" name="subject" placeholder="Ex.: Dúvida sobre uma guia" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Mensagem</Label>
        <Textarea id="body" name="body" rows={4} required />
      </div>

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Abrindo..." : "Abrir chamado"}
      </Button>
    </form>
  );
}
