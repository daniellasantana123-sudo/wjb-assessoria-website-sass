"use client";

import { hasAnalyticsConsent } from "@/lib/consent/cookie-consent";

export type PlanAnalyticsEvent =
  | "plan_view"
  | "plan_details_click"
  | "plan_simulation_start"
  | "plan_simulation_step"
  | "plan_simulation_complete"
  | "plan_simulation_custom_quote"
  | "plan_lead_click"
  | "plan_whatsapp_click";

/**
 * Eventos do funil de Planos/Simulador (seção 32 de WJB_Planos_Simulador_
 * Implementacao_Claude.md) — nunca inclui CNPJ, e-mail, telefone ou nome.
 * Nenhum provider de analytics foi confirmado ainda (seção 36), então isto é
 * um no-op condicionado a consentimento, no mesmo padrão de
 * src/lib/analytics/loader.tsx — plugar o envio real via Adapter Pattern
 * quando um provider for escolhido.
 */
export function trackPlanEvent(
  event: PlanAnalyticsEvent,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_ANALYTICS_ID || !hasAnalyticsConsent()) return;
  void event;
  void data;
}
