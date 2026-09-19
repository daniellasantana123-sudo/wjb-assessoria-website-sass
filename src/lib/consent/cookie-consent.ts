const STORAGE_KEY = "wjb-cookie-consent";

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

/** Usar antes de carregar qualquer script de analytics/terceiros (seção 39). */
export function hasAnalyticsConsent() {
  return getStoredConsent() === "accepted";
}
