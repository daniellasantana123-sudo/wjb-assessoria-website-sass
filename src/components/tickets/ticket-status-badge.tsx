import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TicketStatus } from "@/types/database";

const statusConfig: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Aberto", tone: "info" },
  in_progress: { label: "Em andamento", tone: "warning" },
  closed: { label: "Resolvido", tone: "success" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export { statusConfig as ticketStatusConfig };
