"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail cadastrado</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state?.status === "error" && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar link de redefinição"}
      </Button>

      {state?.status === "success" && (
        <p role="status" className="text-muted-foreground text-center text-sm">
          Se o e-mail estiver cadastrado, você vai receber um link para redefinir a senha.
        </p>
      )}
    </form>
  );
}
