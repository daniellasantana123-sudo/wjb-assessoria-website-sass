/**
 * Regras do popup de captação "Antes de sair" (2026-10-01). Funções puras,
 * testáveis sem navegador; o componente cuida dos eventos e do storage.
 */

export const EXIT_POPUP_STORAGE_KEY = "wjb-exit-popup";
export const EXIT_POPUP_SESSION_KEY = "wjb-exit-popup-shown";

/** Fechou sem enviar: não insistir por 7 dias. */
export const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Tempo mínimo na página antes de aparecer (computador). */
export const MIN_DWELL_DESKTOP_MS = 8_000;
/** Celular: não há "mouse saindo da página"; usa leitura + tempo. */
export const MIN_DWELL_MOBILE_MS = 25_000;
export const MOBILE_SCROLL_RATIO = 0.5;
/**
 * Inatividade (2026-10-01, pedido do usuário): sem mexer o mouse, rolar,
 * tocar ou digitar por 30s, o popup aparece - no computador e no celular.
 */
export const IDLE_MS = 30_000;

/**
 * O gatilho de inatividade não deve interromper quem está digitando
 * (ex.: no assistente virtual, parado pensando) nem abrir por cima de outra
 * janela (menu do celular, outro modal - todos travam a rolagem do body).
 */
export function idleTriggerBlocked({
  activeElementTag,
  activeElementEditable,
  bodyScrollLocked,
  documentHidden,
}: {
  activeElementTag: string | null;
  activeElementEditable: boolean;
  bodyScrollLocked: boolean;
  documentHidden: boolean;
}): boolean {
  if (documentHidden || bodyScrollLocked || activeElementEditable) return true;
  return activeElementTag === "INPUT" || activeElementTag === "TEXTAREA" || activeElementTag === "SELECT";
}

/**
 * Páginas onde o popup atrapalharia: as que já têm formulário de contato,
 * o guia do cliente e as telas de acesso.
 */
const EXCLUDED_PREFIXES = [
  "/contato",
  "/solicitar-proposta",
  "/servicos/abrir-empresa",
  "/servicos/trocar-de-contador",
  "/ajuda",
  "/login",
  "/recuperar-senha",
  "/definir-senha",
  "/verificar-mfa",
  "/portal",
  "/admin",
];

export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type StoredState = { status: "dismissed" | "submitted"; at: number } | null;

export function parseStoredState(raw: string | null): StoredState {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { status?: unknown; at?: unknown };
    if ((value.status === "dismissed" || value.status === "submitted") && typeof value.at === "number") {
      return { status: value.status, at: value.at };
    }
  } catch {
    // valor inválido no storage: trata como nunca visto
  }
  return null;
}

/** Pode aparecer nesta página, agora? (sem considerar o gatilho em si) */
export function canShowPopup({
  pathname,
  stored,
  shownThisSession,
  now,
}: {
  pathname: string;
  stored: StoredState;
  shownThisSession: boolean;
  now: number;
}): boolean {
  if (isExcludedPath(pathname)) return false;
  if (shownThisSession) return false;
  if (stored?.status === "submitted") return false;
  if (stored?.status === "dismissed" && now - stored.at < DISMISS_COOLDOWN_MS) return false;
  return true;
}
