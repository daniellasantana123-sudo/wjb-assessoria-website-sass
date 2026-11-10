import { CONSENT_STORAGE_KEY } from "@/lib/consent/consent-mode";

const STORAGE_KEY = CONSENT_STORAGE_KEY;

export type ConsentChoice = "accepted" | "declined";

type Listener = () => void;
const listeners = new Set<Listener>();

export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function getServerConsentSnapshot(): ConsentChoice | null {
  return null;
}

/** Para useSyncExternalStore reagir a escolhas feitas na mesma aba. */
export function subscribeConsent(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function storeConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, choice);
  listeners.forEach((listener) => listener());
}

/**
 * Apaga a escolha salva para o banner voltar a aparecer
 * ("Preferências de cookies" no rodapé). Revogar tem de ser tão fácil quanto
 * aceitar (LGPD, art. 8º, § 5º).
 */
export function clearConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener());
}

/** Usar antes de carregar qualquer script de analytics/terceiros (seção 39). */
export function hasAnalyticsConsent() {
  return getStoredConsent() === "accepted";
}
