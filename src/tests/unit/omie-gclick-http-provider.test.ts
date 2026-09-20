import { describe, expect, it } from "vitest";

import { createGClickHttpProvider } from "@/integrations/omie-gclick/http.provider";
import { getGClickConfig } from "@/integrations/omie-gclick/config";

/**
 * `GClickHttpProvider` (seção 9 do prompt da Fase 6.5) - esqueleto real,
 * nenhuma chamada de rede. Estes testes garantem que ele nunca finge
 * funcionar, mesmo estruturalmente pronto pra virar a implementação real.
 */
describe("GClickHttpProvider - esqueleto sem chamadas reais", () => {
  it("nenhum método chama fetch", async () => {
    const originalFetch = global.fetch;
    const fetchMock = () => {
      throw new Error("GClickHttpProvider não deveria chamar fetch ainda");
    };
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const provider = createGClickHttpProvider(getGClickConfig());
      await provider.clients.create({
        internalId: "t",
        externalReference: "ref",
        name: "Empresa",
        document: null,
      });
      await provider.clients.update({ externalId: "1" });
      await provider.clients.findById("1");
      await provider.clients.findByExternalReference("ref");
      await provider.clients.list();
      await provider.tasks.list();
      await provider.tasks.createPreTask({ clientExternalId: "1", title: "x" });
      await provider.healthCheck();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("todo método de clients/tasks resolve PROVIDER_NOT_CONFIGURED", async () => {
    const provider = createGClickHttpProvider(getGClickConfig());

    const results = await Promise.all([
      provider.clients.create({ internalId: "t", externalReference: "r", name: "n", document: null }),
      provider.clients.update({ externalId: "1" }),
      provider.clients.findById("1"),
      provider.clients.findByExternalReference("r"),
      provider.clients.list(),
      provider.tasks.list(),
      provider.tasks.createPreTask({ clientExternalId: "1", title: "t" }),
    ]);

    for (const result of results) {
      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "PROVIDER_NOT_CONFIGURED" }) });
    }
  });

  it("healthCheck() reflete o modo configurado, sempre 'not_configured'", async () => {
    const provider = createGClickHttpProvider({ ...getGClickConfig(), mode: "sandbox" });
    expect(await provider.healthCheck()).toEqual({
      provider: "gclick",
      mode: "sandbox",
      status: "not_configured",
    });
  });

  it("getCapabilities() nunca libera nenhuma capacidade (unknown = false)", () => {
    const provider = createGClickHttpProvider(getGClickConfig());
    const capabilities = provider.getCapabilities();
    expect(Object.values(capabilities).every((value) => value === false)).toBe(true);
  });
});
