"use client";

import { useTransition } from "react";

import { updateTicketStatus } from "@/actions/tickets";
import { Select } from "@/components/ui/select";
import { ticketStatusConfig } from "@/components/tickets/ticket-status-badge";
import type { TicketStatus } from "@/types/database";

export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label="Status do chamado"
      defaultValue={status}
      disabled={pending}
      className="h-9 w-auto text-sm"
      onChange={(event) => {
        const next = event.target.value as TicketStatus;
        startTransition(() => {
          updateTicketStatus(ticketId, next);
        });
      }}
    >
      {(Object.keys(ticketStatusConfig) as TicketStatus[]).map((value) => (
        <option key={value} value={value}>
          {ticketStatusConfig[value].label}
        </option>
      ))}
    </Select>
  );
}
