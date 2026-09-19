"use client";

import { useActionState, useRef } from "react";

import { sendMessage } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SendMessageForm({ tenantId }: { tenantId: string }) {
  const sendToTenant = sendMessage.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(sendToTenant, undefined);
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
        rows={2}
        placeholder="Escreva uma mensagem..."
        aria-label="Escreva uma mensagem..."
        required
      />

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
