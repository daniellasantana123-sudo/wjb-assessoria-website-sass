import {
  getFiscalProviderMode,
  isFiscalProductionAllowed,
} from "@/lib/wjb-ai/config";
import {
  MockFiscalProvider,
  scenarioByAmount,
} from "@/lib/wjb-ai/fiscal/provider/mock.provider";
import {
  FiscalProviderUnavailableError,
  type FiscalProvider,
} from "@/lib/wjb-ai/fiscal/provider/types";

/**
 * Único ponto que entrega um conector fiscal. Homologação e produção
 * recusam de propósito: não há conector oficial escrito, e escrevê-lo contra
 * endpoints presumidos é proibido pelo documento mestre (seção 7.2).
 */
export function getFiscalProvider(): FiscalProvider {
  const mode = getFiscalProviderMode();
  if (mode === "mock")
    return new MockFiscalProvider("autorizada", scenarioByAmount);
  if (mode === "producao" && !isFiscalProductionAllowed()) {
    throw new FiscalProviderUnavailableError("Emissão em produção bloqueada.");
  }
  throw new FiscalProviderUnavailableError(
    "Conector oficial de NFS-e ainda não implementado (fase F4, depende da documentação vigente e de homologação).",
  );
}

export {
  MockFiscalProvider,
  scenarioByAmount,
} from "@/lib/wjb-ai/fiscal/provider/mock.provider";
export type * from "@/lib/wjb-ai/fiscal/provider/types";
