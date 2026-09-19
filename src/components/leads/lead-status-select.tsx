"use client";

import { useTransition } from "react";

import { updateLeadStatus } from "@/actions/leads";
import { Select } from "@/components/ui/select";
import type { LeadStatus } from "@/types/database";

const statusLabels: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  won: "Convertido",
  lost: "Perdido",
};

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label="Status do lead"
      defaultValue={status}
      disabled={pending}
      className="h-9 w-auto text-sm"
      onChange={(event) => {
        const next = event.target.value as LeadStatus;
        startTransition(() => {
          updateLeadStatus(leadId, next);
        });
      }}
    >
      {(Object.keys(statusLabels) as LeadStatus[]).map((value) => (
        <option key={value} value={value}>
          {statusLabels[value]}
        </option>
      ))}
    </Select>
  );
}
