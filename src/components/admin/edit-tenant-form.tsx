"use client";

import { useActionState } from "react";

import { updateTenant } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditTenantForm({
  tenantId,
  name,
  cnpj,
}: {
  tenantId: string;
  name: string;
  cnpj: string | null;
}) {
  const updateTenantForId = updateTenant.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(updateTenantForId, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome da empresa</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj">CNPJ (opcional)</Label>
          <Input id="cnpj" name="cnpj" defaultValue={cnpj ?? ""} />
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-brand-green-700 text-sm">
          {state.success}
        </p>
      )}

      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
