import type { AntivirusAdapter, ScanResult } from "./types";

/**
 * Sempre "limpo" — nenhum provider de antivírus real está configurado.
 * Existe pra que o ponto de chamada (`uploadDocument`) já esteja pronto:
 * no dia em que um provider real for escolhido, só trocar o que
 * `getAntivirusAdapter()` retorna, sem mudar `src/actions/documents.ts`.
 */
export const noopAntivirusAdapter: AntivirusAdapter = {
  async scan(): Promise<ScanResult> {
    return { clean: true };
  },
};
