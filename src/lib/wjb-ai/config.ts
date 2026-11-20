/**
 * Interruptores do módulo WJB AI (F1, 2026-11-20).
 *
 * Lidos em RUNTIME por acesso dinâmico (`process.env[nome]`): nesta
 * hospedagem o build não recebe as variáveis do painel (ver CLAUDE.md), e uma
 * leitura literal congelaria o valor do build.
 *
 * Os dois começam DESLIGADOS. `FEATURE_FISCAL_PRODUCTION_ENABLED` sozinho não
 * autoriza nada: transmissão de produção também exige aprovação registrada de
 * responsável habilitado, que ainda não existe neste incremento - por isso
 * `isFiscalProductionAllowed()` devolve sempre `false` aqui.
 */

function readFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

/** Liga as rotas do WJB AI. Desligado: as rotas respondem 404. */
export function isWjbAiEnabled(): boolean {
  return readFlag("WJB_AI_ENABLED");
}

export type FiscalProviderMode = "mock" | "homologacao" | "producao";

/** Modo do conector fiscal. Qualquer valor desconhecido cai em `mock`. */
export function getFiscalProviderMode(): FiscalProviderMode {
  const value = process.env["WJB_AI_FISCAL_MODE"]?.trim().toLowerCase();
  return value === "homologacao" || value === "producao" ? value : "mock";
}

/**
 * Produção fiscal. Bloqueada neste incremento independentemente da flag: não
 * existe conector oficial nem registro de aprovação de responsável.
 */
export function isFiscalProductionAllowed(): boolean {
  void readFlag("FEATURE_FISCAL_PRODUCTION_ENABLED");
  return false;
}
