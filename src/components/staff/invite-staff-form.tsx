"use client";

import { useActionState } from "react";

import { inviteStaffMember } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function InviteStaffForm() {
  const [state, formAction, pending] = useActionState(inviteStaffMember, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nome</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="staffRole">Papel</Label>
          <Select id="staffRole" name="staffRole" defaultValue="atendimento">
            <option value="atendimento">Atendimento</option>
            <option value="contador">Contador</option>
            <option value="super_admin">Super admin</option>
          </Select>
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

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Conceder acesso"}
      </Button>
    </form>
  );
}
