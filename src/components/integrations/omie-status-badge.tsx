import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { OmieIntegrationStatus } from "@/types/database";
import type { ProviderMode } from "@/integrations/omie-gclick";

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

/**
 * `mode` (Fase 6.5 - "mocks e contratos internos") - quando o provider
 * ativo é o mock, "Sincronizado" nunca pode aparecer como se fosse uma
 * sincronização real (seção 37 do prompt: "não apresentar como Conectado
 * ao G-Click real"). O status técnico salvo no banco continua `synced`
 * (é o que realmente aconteceu do ponto de vista do fluxo), só o RÓTULO
 * é decorado para deixar claro que foi simulado.
 */
export function OmieStatusBadge({ status, mode }: { status: OmieIntegrationStatus; mode?: ProviderMode }) {
  const isSimulated = mode === "mock" && status === "synced";
  const label = isSimulated ? `${STATUS_LABELS[status]} (simulado - modo mock)` : STATUS_LABELS[status];
  const tone = isSimulated ? "warning" : STATUS_TONES[status];

  return <Badge tone={tone}>{label}</Badge>;
}
