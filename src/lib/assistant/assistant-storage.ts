import type { AssistantScreen, AssistantServiceKey } from "@/types/assistant";

/**
 * Persistência do assistente (seção "PERSISTÊNCIA"/"LGPD") - guarda só UI
 * state (painel minimizado ou não, tela atual, serviço escolhido) em
 * `sessionStorage`, cada campo sob sua própria chave (string simples, nunca
 * um blob JSON) pra que `useSyncExternalStore` receba sempre um primitivo
 * referencialmente estável - evita tanto o erro de lint `react-hooks/set-state-in-effect`
 * quanto o aviso "getSnapshot should be cached" do React. "open"/"greeting"
 * nunca são persistidos (são transitórios da aba atual - ver
 * `WJBAssistant.tsx`). Nunca nome/telefone/e-mail: esses ficam só no estado
 * em memória de `AssistantLeadForm`, nunca tocam storage.
 */
const WIDGET_STATE_KEY = "wjb-assistant-widget-state";
const SCREEN_KEY = "wjb-assistant-screen";
const SERVICE_KEY = "wjb-assistant-service";
const GREETING_KEY = "wjb-assistant-greeting-shown";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeAssistantStorage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
    notify();
  } catch {
    // sessionStorage indisponível (modo privado, cota excedida) - ignorar.
  }
}

/** Baseline persistida do widget - só "closed" ou "minimized". */
export function getStoredWidgetState(): "closed" | "minimized" {
  return readKey(WIDGET_STATE_KEY) === "minimized" ? "minimized" : "closed";
}
export function setStoredWidgetState(value: "closed" | "minimized") {
  writeKey(WIDGET_STATE_KEY, value === "closed" ? null : value);
}
export function getServerWidgetStateSnapshot(): "closed" | "minimized" {
  return "closed";
}

export function getStoredScreen(): AssistantScreen {
  const raw = readKey(SCREEN_KEY);
  return raw === "service" || raw === "lead" || raw === "completed" ? raw : "menu";
}
export function setStoredScreen(value: AssistantScreen) {
  writeKey(SCREEN_KEY, value === "menu" ? null : value);
}
export function getServerScreenSnapshot(): AssistantScreen {
  return "menu";
}

export function getStoredService(): AssistantServiceKey | null {
  return readKey(SERVICE_KEY) as AssistantServiceKey | null;
}
export function setStoredService(value: AssistantServiceKey | null) {
  writeKey(SERVICE_KEY, value);
}
export function getServerServiceSnapshot(): AssistantServiceKey | null {
  return null;
}

/** Saudação automática mostrada só uma vez por sessão (seção "FREQUÊNCIA"). */
export function hasShownGreeting(): boolean {
  return readKey(GREETING_KEY) === "true";
}
export function markGreetingShown() {
  writeKey(GREETING_KEY, "true");
}
