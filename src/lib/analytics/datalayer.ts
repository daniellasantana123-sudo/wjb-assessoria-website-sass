/**
 * Camada única de eventos (`window.dataLayer`), lida pelo Google Tag Manager.
 * Contrato completo em `docs/comercial/CONTRATO_EVENTOS_DATALAYER_WJB.md`.
 *
 * Regras que esta função garante, independente de quem chama:
 * - só parâmetros da lista `ALLOWED_PARAMS` passam - nunca nome, e-mail,
 *   telefone, CPF/CNPJ ou mensagem (LGPD e política do Google Ads);
 * - valores de texto são cortados em 100 caracteres;
 * - um `event_id` já enviado não é enviado de novo (deduplicação).
 *
 * Empurrar no `dataLayer` não envia nada para a rede: quem envia é o GTM, e
 * ele só é carregado depois do consentimento (`GoogleTagManager`).
 */

export type AnalyticsEventName =
  | "view_service"
  | "select_service"
  | "form_start"
  | "generate_lead"
  | "click_whatsapp"
  | "chat_start"
  | "newsletter_signup";

export type AnalyticsParams = Partial<Record<(typeof ALLOWED_PARAMS)[number], string | number | boolean>>;

export const ALLOWED_PARAMS = [
  "event_id",
  "service_id",
  "service_name",
  "form_id",
  "link_location",
  "link_url",
  "page_path",
  "landing_page",
  "lead_source",
  "lead_medium",
  "lead_campaign",
] as const;

const MAX_VALUE_LENGTH = 100;
const sentEventIds = new Set<string>();

type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function sanitizeParams(params: Record<string, unknown> = {}): AnalyticsParams {
  const clean: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED_PARAMS) {
    const value = params[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) clean[key] = trimmed.slice(0, MAX_VALUE_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = value;
    } else if (typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}

/** Devolve `true` quando o evento foi colocado na fila. */
export function pushEvent(event: AnalyticsEventName, params: Record<string, unknown> = {}): boolean {
  if (typeof window === "undefined") return false;
  const clean = sanitizeParams(params);
  const eventId = typeof clean.event_id === "string" ? clean.event_id : null;
  if (eventId) {
    if (sentEventIds.has(eventId)) return false;
    sentEventIds.add(eventId);
  }
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, page_path: window.location.pathname, ...clean });
  return true;
}

/** Só para testes. */
export function resetSentEventIds() {
  sentEventIds.clear();
}
