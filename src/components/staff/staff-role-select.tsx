"use client";

import { useRef, useTransition } from "react";

import { updateStaffRole } from "@/actions/staff";
import { Select } from "@/components/ui/select";
import type { StaffRole } from "@/types/database";

const roleLabels: Record<StaffRole, string> = {
  super_admin: "Super admin",
  contador: "Contador",
  atendimento: "Atendimento",
};

export function StaffRoleSelect({
  profileId,
  role,
  personLabel,
}: {
  profileId: string;
  role: StaffRole;
  personLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  // Último papel confirmado: se a pessoa cancelar, o select volta para ele.
  const confirmedRole = useRef<StaffRole>(role);

  return (
    <Select
      aria-label="Papel da pessoa"
      defaultValue={role}
      disabled={pending}
      className="h-9 w-auto text-sm"
      onChange={(event) => {
        const next = event.target.value as StaffRole;
        // Trocar papel muda o que a pessoa pode fazer na hora (ex.: virar
        // Super admin) - pede confirmação para não acontecer por engano.
        if (
          !window.confirm(
            `Mudar o papel de ${personLabel} para ${roleLabels[next]}? A mudança vale na hora.`,
          )
        ) {
          event.target.value = confirmedRole.current;
          return;
        }
        confirmedRole.current = next;
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
