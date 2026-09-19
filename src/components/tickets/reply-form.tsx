"use client";

import { useActionState, useRef } from "react";

import { replyTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReplyForm({ ticketId, tenantId }: { ticketId: string; tenantId: string }) {
  const replyToTicket = replyTicket.bind(null, ticketId, tenantId);
  const [state, formAction, pending] = useActionState(replyToTicket, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3"
    >
      <Textarea
        name="body"
        rows={3}
        placeholder="Escreva uma resposta..."
        aria-label="Escreva uma resposta..."
        required
      />

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Responder"}
      </Button>
    </form>
  );
}
