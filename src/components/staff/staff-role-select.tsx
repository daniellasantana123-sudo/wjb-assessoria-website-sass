"use client";

import { useTransition } from "react";

import { updateStaffRole } from "@/actions/staff";
import { Select } from "@/components/ui/select";
import type { StaffRole } from "@/types/database";

const roleLabels: Record<StaffRole, string> = {
  super_admin: "Super admin",
  contador: "Contador",
  atendimento: "Atendimento",
};

export function StaffRoleSelect({ profileId, role }: { profileId: string; role: StaffRole }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label="Papel da pessoa"
      defaultValue={role}
      disabled={pending}
      className="h-9 w-auto text-sm"
      onChange={(event) => {
        const next = event.target.value as StaffRole;
        startTransition(() => {
          updateStaffRole(profileId, next);
        });
      }}
    >
      {(Object.keys(roleLabels) as StaffRole[]).map((value) => (
        <option key={value} value={value}>
          {roleLabels[value]}
        </option>
      ))}
    </Select>
  );
}
