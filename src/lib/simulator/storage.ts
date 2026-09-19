import type { SimulationState } from "@/types/pricing";

/**
 * Persistência do simulador (seção 31 de WJB_Planos_Simulador_Implementacao_
 * Claude.md) — só guarda as escolhas do formulário (regime, UF, atividade,
 * sócios, empregados, faturamento, adicionais), nunca nome/CNPJ/e-mail/
 * telefone, que vivem só no estado do PlanLeadForm e nunca tocam localStorage.
 */
const STORAGE_KEY = "wjb-plan-simulator";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Para useSyncExternalStore reagir a leituras/escritas feitas na mesma aba. */
export function subscribeSimulationStorage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readStoredSimulation(): SimulationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimulationState;
  } catch {
    return null;
  }
}

/**
 * Snapshot booleano (não o objeto inteiro) para useSyncExternalStore —
 * primitivos comparam por valor, evitando o loop de "getSnapshot deve ser
 * cacheado" que aconteceria devolvendo um objeto novo a cada chamada.
 */
export function hasStoredSimulationSnapshot(): boolean {
  return readStoredSimulation()?.regime != null;
}

export function getServerSimulationSnapshot(): boolean {
  return false;
}

export function saveStoredSimulation(state: SimulationState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  } catch {
    // localStorage indisponível (modo privado, cota excedida) — ignorar.
  }
}

export function clearStoredSimulation() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notify();
  } catch {
    // Idem.
  }
}
