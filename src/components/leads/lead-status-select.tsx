"use client";

import { useTransition } from "react";

import { updateLeadStatus } from "@/actions/leads";
import { Select } from "@/components/ui/select";
import type { LeadStatus } from "@/types/database";

// Ordem = ordem do funil comercial (migration 0023). "contacted" e "won"
// mantêm o valor antigo no banco e só mudaram de rótulo.
const statusLabels: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Em atendimento",
  qualified: "Qualificado",
  proposal_sent: "Proposta enviada",
  negotiation: "Negociação",
  won: "Contratado",
  lost: "Perdido ou desqualificado",
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
