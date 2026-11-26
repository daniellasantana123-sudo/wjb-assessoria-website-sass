import { Badge } from "@/components/ui/badge";
import {
  FISCAL_STATUS_LABELS,
  FISCAL_STATUS_TONE,
  SIMULATION_LABEL,
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

export function SimulationNotice({
  audience = "cliente",
}: {
  audience?: "cliente" | "equipe";
}) {
  return (
    <div
      role="note"
      className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm"
    >
      <Badge tone="warning">{SIMULATION_LABEL}</Badge>{" "}
      <span className="text-foreground">
        {audience === "equipe"
          ? "Conector, assinatura e certificado são simulados. Nada aqui é transmitido ao governo e nenhuma nota tem valor fiscal."
          : "As solicitações ficam registradas e são revisadas pela WJB, mas nenhuma nota fiscal é emitida nesta fase."}
      </span>
    </div>
  );
}
