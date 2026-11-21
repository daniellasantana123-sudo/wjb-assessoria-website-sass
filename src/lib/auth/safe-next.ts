/**
 * Destino de retorno seguro depois de confirmar o MFA (Fase 10A): só caminhos
 * internos do Portal ou do Admin; nunca URL externa nem `//host`.
 */
export function safeAppPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/(admin|portal)(\/|\?|$)/.test(value) || value.startsWith("//") || value.includes("\\") || value.length > 300) return null;
  return value;
}
