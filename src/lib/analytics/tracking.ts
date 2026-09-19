"use client";

/**
 * Captura origem/URL/UTM para formulários — seção 19 de Wjb-Website.md.
 * Sem cookies/analytics de terceiros: lê apenas a query string e o path atuais.
 */
export function getTrackingParams(pathname: string) {
  if (typeof window === "undefined") {
    return { sourcePath: pathname, utmSource: null, utmMedium: null, utmCampaign: null };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    sourcePath: pathname,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
  };
}
