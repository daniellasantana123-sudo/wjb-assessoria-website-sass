"use client";

import { useEffect } from "react";

import { hasAnalyticsConsent } from "@/lib/consent/cookie-consent";

/**
 * Nenhum provider de analytics foi confirmado ainda (seção 36). Este
 * componente só carrega um script quando `NEXT_PUBLIC_ANALYTICS_ID` estiver
 * definido E o usuário tiver consentido (seção 39) — hoje é um no-op.
 * Plugar o provider real aqui via Adapter Pattern quando for escolhido.
 */
export function AnalyticsLoader() {
  useEffect(() => {
    const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
    if (!analyticsId || !hasAnalyticsConsent()) return;

    // Ex.: injetar aqui o script do provider escolhido (GA4, Plausible, etc.).
  }, []);

  return null;
}
