import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { OmieIntegrationStatus } from "@/types/database";

const STATUS_LABELS: Record<OmieIntegrationStatus, string> = {
  not_connected: "Não conectado",
  pending: "Pendente",
  connected: "Conectado",
  syncing: "Sincronizando...",
  synced: "Sincronizado",
  conflict: "Conflito",
  error: "Erro",
  disabled: "Desativado",
};

const STATUS_TONES: Record<OmieIntegrationStatus, BadgeTone> = {
  not_connected: "neutral",
  pending: "warning",
  connected: "info",
  syncing: "info",
  synced: "success",
  conflict: "warning",
  error: "danger",
  disabled: "neutral",
};

export function OmieStatusBadge({ status }: { status: OmieIntegrationStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
