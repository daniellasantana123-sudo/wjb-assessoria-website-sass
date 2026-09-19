"use client";

import { useActionState } from "react";

import { createTenant } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(createTenant, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome da empresa</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj">CNPJ (opcional)</Label>
          <Input id="cnpj" name="cnpj" />
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Criando..." : "Criar empresa"}
      </Button>
    </form>
  );
}
