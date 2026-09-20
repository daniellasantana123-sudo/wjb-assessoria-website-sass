import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOmieAdapter } from "@/integrations/omie-gclick/omie.adapter";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("createOmieAdapter - upsertClient", () => {
  it("chama IncluirCliente quando não há externalClientId, e devolve o código do Omie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ codigo_cliente_omie: 123456 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createOmieAdapter("key", "secret");
    const result = await adapter.upsertClient({ tenantId: "tenant-1", name: "Empresa X", cnpj: "12345678000100" });

    expect(result).toEqual({ ok: true, externalClientId: "123456" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.call).toBe("IncluirCliente");
    expect(body.app_key).toBe("key");
    expect(body.app_secret).toBe("secret");
    expect(body.param[0].razao_social).toBe("Empresa X");
    expect(body.param[0].codigo_cliente_integracao).toBe("wjb-tenant-tenant-1");
  });

  it("chama AlterarCliente quando já existe externalClientId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ codigo_cliente_omie: 123456 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createOmieAdapter("key", "secret");
    await adapter.upsertClient({
      tenantId: "tenant-1",
      name: "Empresa X",
      cnpj: null,
      externalClientId: "123456",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.call).toBe("AlterarCliente");
    expect(body.param[0].codigo_cliente_omie).toBe(123456);
  });

  it("trata faultstring no corpo (HTTP 200) como erro, sem lançar exceção", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ faultstring: "CNPJ inválido", faultcode: "SOAP-ENV:Client-115" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createOmieAdapter("key", "secret");
    const result = await adapter.upsertClient({ tenantId: "tenant-1", name: "Empresa X", cnpj: "0" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("SOAP-ENV:Client-115");
  });

  it("nunca lança exceção quando a rede falha — resolve com erro", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const adapter = createOmieAdapter("key", "secret");
    const result = await adapter.upsertClient({ tenantId: "tenant-1", name: "Empresa X", cnpj: null });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("omie-network-error");
  });
});

describe("getOmieGClickAdapter - fallback no-op", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sem OMIE_APP_KEY/OMIE_APP_SECRET, nunca chama a rede e retorna erro sem lançar", async () => {
    delete process.env.OMIE_APP_KEY;
    delete process.env.OMIE_APP_SECRET;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getOmieGClickAdapter } = await import("@/integrations/omie-gclick/provider");
    const result = await getOmieGClickAdapter().upsertClient({
      tenantId: "tenant-1",
      name: "Empresa X",
      cnpj: null,
    });

    expect(result).toEqual({ ok: false, error: "no-provider" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
