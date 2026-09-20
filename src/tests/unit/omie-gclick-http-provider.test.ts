import { describe, expect, it } from "vitest";

import { createGClickHttpProvider, isRealProviderImplemented } from "@/integrations/omie-gclick/http.provider";
import { getGClickConfig } from "@/integrations/omie-gclick/config";

/**
 * `GClickHttpProvider` (seção 9 do prompt da Fase 6.5, endurecido no
 * Checkpoint 6.5.1) - esqueleto real, nenhuma chamada de rede. Estes
 * testes garantem que ele nunca finge funcionar, mesmo estruturalmente
 * pronto pra virar a implementação real, e que as 2 proteções
 * independentes (feature flag + `REAL_PROVIDER_IMPLEMENTED`) realmente
 * bloqueiam sozinhas.
 */
describe("GClickHttpProvider - esqueleto sem chamadas reais", () => {
  it("nenhum método chama fetch", async () => {
    const originalFetch = global.fetch;
    const fetchMock = () => {
      throw new Error("GClickHttpProvider não deveria chamar fetch ainda");
    };
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag: false });
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

  it("todo método de clients/tasks resolve PROVIDER_NOT_CONFIGURED, com a flag desligada ou ligada", async () => {
    for (const blockedByFeatureFlag of [true, false]) {
      const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag });

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
        expect(result).toEqual({
          ok: false,
          error: expect.objectContaining({ code: "PROVIDER_NOT_CONFIGURED" }),
        });
      }
    }
  });

  it("healthCheck() reflete o modo configurado, sempre 'not_configured'", async () => {
    const provider = createGClickHttpProvider(
      { ...getGClickConfig(), mode: "sandbox" },
      { blockedByFeatureFlag: false },
    );
    expect(await provider.healthCheck()).toEqual({
      provider: "gclick",
      mode: "sandbox",
      status: "not_configured",
    });
  });

  it("getCapabilities() nunca libera nenhuma capacidade (unknown = false)", () => {
    const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag: false });
    const capabilities = provider.getCapabilities();
    expect(Object.values(capabilities).every((value) => value === false)).toBe(true);
  });

  describe("Checkpoint 6.5.1 - duas proteções independentes", () => {
    it("Proteção 2 (REAL_PROVIDER_IMPLEMENTED) continua false - nenhuma implementação real existe", () => {
      expect(isRealProviderImplemented()).toBe(false);
    });

    it("Proteção 1 (feature flag) desligada: mensagem de erro cita a env var", async () => {
      const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag: true });
      const result = await provider.clients.create({
        internalId: "t",
        externalReference: "r",
        name: "n",
        document: null,
      });
      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ message: expect.stringContaining("GCLICK_REAL_INTEGRATION_ENABLED") }),
      });
    });

    it("Proteção 1 ligada (flag=true), mas Proteção 2 continua bloqueando sozinha - mensagem não cita a env var", async () => {
      const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag: false });
      const result = await provider.clients.create({
        internalId: "t",
        externalReference: "r",
        name: "n",
        document: null,
      });
      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "PROVIDER_NOT_CONFIGURED" }),
      });
      if (!result.ok) {
        expect(result.error.message).not.toContain("GCLICK_REAL_INTEGRATION_ENABLED");
        expect(result.error.message).toContain("TODO_GCLICK_VALIDATION");
      }
    });

    it("mesmo com a flag ligada, healthCheck() continua 'not_configured' (Proteção 2 sozinha basta)", async () => {
      const provider = createGClickHttpProvider(getGClickConfig(), { blockedByFeatureFlag: false });
      expect((await provider.healthCheck()).status).toBe("not_configured");
    });
  });
});
