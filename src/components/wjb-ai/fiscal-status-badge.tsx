import { Badge } from "@/components/ui/badge";
import {
  FISCAL_STATUS_LABELS,
  FISCAL_STATUS_TONE,
} from "@/lib/wjb-ai/fiscal/labels";
import {
  isOfficiallyAuthorized,
  type FiscalStatus,
} from "@/lib/wjb-ai/fiscal/status";

/** `simulated`: autorização vinda do conector simulado nunca aparece como nota real. */
export function FiscalStatusBadge({
  status,
  simulated = false,
}: {
  status: FiscalStatus;
  simulated?: boolean;
}) {
  if (simulated && isOfficiallyAuthorized(status)) {
    return <Badge tone="warning">Autorizada em simulação</Badge>;
  }
  return (
    <Badge tone={FISCAL_STATUS_TONE[status] ?? "info"}>
      {FISCAL_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function SimulationNotice() {
  return (
    <div className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm">
      <Badge tone="warning">Simulação</Badge>{" "}
      <span className="text-foreground">
        As solicitações ficam registradas e são revisadas pela WJB, mas nenhuma
        nota fiscal é emitida nesta fase.
      </span>
    </div>
  );
}
