"use client";

/**
 * Origem do lead (seção 19 de Wjb-Website.md; ampliado em 2026-11-09 para
 * Google Ads, Fase 4 do plano comercial).
 *
 * A campanha chega na URL da página de entrada (`?utm_source=...&gclid=...`),
 * mas o visitante costuma navegar antes de preencher o formulário, e a URL
 * da página do formulário já não tem esses parâmetros. Por isso a origem da
 * primeira página da visita fica guardada no `sessionStorage` (some ao
 * fechar a aba) e é enviada junto com o lead. Não usa cookie nem analytics
 * de terceiros, e nada aqui identifica a pessoa: são só os parâmetros da
 * campanha e o caminho da página de entrada.
 */
const STORAGE_KEY = "wjb-first-touch";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"] as const;

type FirstTouch = Partial<Record<(typeof PARAMS)[number], string>> & { landing_page?: string };

function readStored(): FirstTouch | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** Grava a origem na primeira página da visita; páginas seguintes não sobrescrevem. */
export function captureFirstTouch() {
  if (typeof window === "undefined" || readStored()) return;
  const params = new URLSearchParams(window.location.search);
  const touch: FirstTouch = { landing_page: window.location.pathname };
  for (const key of PARAMS) {
    const value = params.get(key)?.trim();
    if (value) touch[key] = value.slice(0, 200);
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue só com a URL atual.
  }
}

export function getTrackingParams(pathname: string) {
  if (typeof window === "undefined") {
    return {
      sourcePath: pathname,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      gclid: null,
      landingPage: null,
    };
  }

  captureFirstTouch();
  const stored = readStored() ?? {};
  const current = new URLSearchParams(window.location.search);
  const pick = (key: (typeof PARAMS)[number]) => current.get(key) || stored[key] || null;

  return {
    sourcePath: pathname,
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmTerm: pick("utm_term"),
    utmContent: pick("utm_content"),
    gclid: pick("gclid"),
    landingPage: stored.landing_page ?? null,
  };
}

/**
 * Origem da visita no formato dos parâmetros do `dataLayer`. O `gclid` fica
 * de fora de propósito: o próprio Google Ads já o associa à conversão.
 */
export function getAttributionParams() {
  const t = getTrackingParams(typeof window === "undefined" ? "" : window.location.pathname);
  return {
    landing_page: t.landingPage ?? undefined,
    lead_source: t.utmSource ?? undefined,
    lead_medium: t.utmMedium ?? undefined,
    lead_campaign: t.utmCampaign ?? undefined,
  };
}
