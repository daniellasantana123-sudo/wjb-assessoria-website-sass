"use client";

import { hasAnalyticsConsent } from "@/lib/consent/cookie-consent";

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
 * Eventos do Assistente Virtual (prompt mestre, seção "ANALYTICS") - nunca
 * inclui nome, telefone, e-mail ou qualquer dado pessoal, só a chave do
 * serviço (ex.: "abrirEmpresa"). Mesmo padrão no-op condicionado a
 * consentimento de `plan-events.ts` - nenhum provider de analytics novo foi
 * adicionado, nenhum confirmado ainda pela WJB (seção 36 de Wjb-Website.md).
 */
export function trackAssistantEvent(
  event: AssistantAnalyticsEvent,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_ANALYTICS_ID || !hasAnalyticsConsent()) return;
  void event;
  void data;
}
