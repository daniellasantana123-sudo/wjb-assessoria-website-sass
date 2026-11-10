"use client";

import { pushEvent } from "@/lib/analytics/datalayer";

export type AssistantAnalyticsEvent =
  | "assistant_viewed"
  | "assistant_opened"
  | "assistant_service_selected"
  | "assistant_form_started"
  | "assistant_form_completed"
  | "assistant_whatsapp_clicked"
  | "assistant_route_clicked"
  | "assistant_closed";

/**
 * Eventos do Assistente Virtual - nunca incluem nome, telefone, e-mail ou
 * qualquer dado pessoal, só a chave do serviço (ex.: "abrirEmpresa").
 *
 * Desde a Fase 6 do plano comercial (2026-11-10) dois deles também viram
 * eventos do contrato comum do `dataLayer`: abrir o painel é `chat_start` e
 * escolher um serviço é `select_service`. Os demais seguem sem envio - eles
 * existem para análise futura do funil do próprio assistente, e mandar todos
 * para o GA4 só poluiria os relatórios. O clique no WhatsApp já é medido
 * para o site inteiro em `GoogleTagManager`.
 */
export function trackAssistantEvent(
  event: AssistantAnalyticsEvent,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  if (event === "assistant_opened") {
    pushEvent("chat_start", { link_location: typeof data?.source === "string" ? data.source : "botao" });
  } else if (event === "assistant_service_selected") {
    pushEvent("select_service", {
      service_id: typeof data?.service === "string" ? data.service : undefined,
      link_location: "assistente",
    });
  }
}
