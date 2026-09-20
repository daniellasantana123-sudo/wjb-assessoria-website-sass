import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getOmieGClickAdapter,
  isOmieConfigured,
  resetOmieGClickAdapterForTests,
} from "@/integrations/omie-gclick/provider";
import { getGClickConfig } from "@/integrations/omie-gclick/config";

const ENV_KEYS = [
  "GCLICK_MODE",
  "GCLICK_REAL_INTEGRATION_ENABLED",
  "GCLICK_BASE_URL",
  "GCLICK_CLIENT_ID",
  "GCLICK_CLIENT_SECRET",
  "GCLICK_API_KEY",
  "GCLICK_TOKEN",
  "GCLICK_TIMEOUT_MS",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  resetOmieGClickAdapterForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetOmieGClickAdapterForTests();
});

describe("getGClickConfig", () => {
  it("sem nenhuma env var, cai em modo mock com timeout padrão", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const config = getGClickConfig();
    expect(config.mode).toBe("mock");
    expect(config.realIntegrationEnabled).toBe(false);
    expect(config.timeoutMs).toBe(10_000);
  });

  it("GCLICK_MODE inválido cai em mock (nunca em modo real por omissão/erro) e sinaliza o erro de config", () => {
    process.env.GCLICK_MODE = "qualquer-coisa";
    const config = getGClickConfig();
    expect(config.mode).toBe("mock");
    expect(config.modeConfigError).toContain("qualquer-coisa");
  });

  it("GCLICK_MODE ausente ou 'mock' não geram erro de config", () => {
    delete process.env.GCLICK_MODE;
    expect(getGClickConfig().modeConfigError).toBeNull();
    process.env.GCLICK_MODE = "mock";
    expect(getGClickConfig().modeConfigError).toBeNull();
  });

  it("GCLICK_MODE 'sandbox'/'production' válidos não geram erro de config", () => {
    process.env.GCLICK_MODE = "sandbox";
    expect(getGClickConfig().modeConfigError).toBeNull();
    process.env.GCLICK_MODE = "production";
    expect(getGClickConfig().modeConfigError).toBeNull();
  });

  it("GCLICK_REAL_INTEGRATION_ENABLED só é true com a string exata 'true'", () => {
    process.env.GCLICK_REAL_INTEGRATION_ENABLED = "1";
    expect(getGClickConfig().realIntegrationEnabled).toBe(false);
    process.env.GCLICK_REAL_INTEGRATION_ENABLED = "true";
    expect(getGClickConfig().realIntegrationEnabled).toBe(true);
  });

  it("GCLICK_TIMEOUT_MS inválido cai no padrão de 10s", () => {
    process.env.GCLICK_TIMEOUT_MS = "not-a-number";
    expect(getGClickConfig().timeoutMs).toBe(10_000);
  });
});

describe("getOmieGClickAdapter - seleção de provider", () => {
  it("isOmieConfigured() é sempre falso (nenhuma implementação real existe ainda)", () => {
    expect(isOmieConfigured()).toBe(false);
  });

  it("modo mock (padrão) devolve um provider com healthCheck 'available'", async () => {
    delete process.env.GCLICK_MODE;
    const health = await getOmieGClickAdapter().healthCheck();
    expect(health).toEqual({ provider: "gclick", mode: "mock", status: "available" });
  });

  it("modo sandbox devolve o provider sempre bloqueado ('not_configured')", async () => {
    process.env.GCLICK_MODE = "sandbox";
    const health = await getOmieGClickAdapter().healthCheck();
    expect(health).toEqual({ provider: "gclick", mode: "sandbox", status: "not_configured" });
  });

  it("modo production, mesmo com GCLICK_REAL_INTEGRATION_ENABLED=true, continua bloqueado (nenhuma implementação real existe)", async () => {
    process.env.GCLICK_MODE = "production";
    process.env.GCLICK_REAL_INTEGRATION_ENABLED = "true";
    const health = await getOmieGClickAdapter().healthCheck();
    expect(health).toEqual({ provider: "gclick", mode: "production", status: "not_configured" });
  });

  describe("Checkpoint 6.5.1 - as 2 proteções, exercitadas via factory completa", () => {
    it("sandbox sem a flag: erro cita GCLICK_REAL_INTEGRATION_ENABLED (Proteção 1)", async () => {
      process.env.GCLICK_MODE = "sandbox";
      delete process.env.GCLICK_REAL_INTEGRATION_ENABLED;

      const result = await getOmieGClickAdapter().clients.create({
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

    it("production COM a flag=true: ainda bloqueado, mas por outro motivo (Proteção 2, TODO_GCLICK_VALIDATION)", async () => {
      process.env.GCLICK_MODE = "production";
      process.env.GCLICK_REAL_INTEGRATION_ENABLED = "true";

      const result = await getOmieGClickAdapter().clients.create({
        internalId: "t",
        externalReference: "r",
        name: "n",
        document: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).not.toContain("GCLICK_REAL_INTEGRATION_ENABLED");
        expect(result.error.message).toContain("TODO_GCLICK_VALIDATION");
      }
    });
  });

  it("nunca chama fetch em nenhum modo", async () => {
    const originalFetch = global.fetch;
    global.fetch = (() => {
      throw new Error("getOmieGClickAdapter não deveria chamar fetch");
    }) as unknown as typeof fetch;

    try {
      for (const mode of ["mock", "sandbox", "production"]) {
        resetOmieGClickAdapterForTests();
        process.env.GCLICK_MODE = mode;
        await getOmieGClickAdapter().healthCheck();
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
