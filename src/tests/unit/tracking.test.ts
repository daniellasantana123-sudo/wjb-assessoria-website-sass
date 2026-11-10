import { afterEach, describe, expect, it, vi } from "vitest";

import { getTrackingParams } from "@/lib/analytics/tracking";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function stubWindow(search: string, pathname: string, storage = memoryStorage()) {
  vi.stubGlobal("window", { location: { search, pathname }, sessionStorage: storage });
  return storage;
}

describe("getTrackingParams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lê UTM, termo, conteúdo e gclid da URL atual", () => {
    stubWindow(
      "?utm_source=google&utm_medium=cpc&utm_campaign=lancamento&utm_term=abrir+empresa&gclid=abc",
      "/servicos/abrir-empresa",
    );

    const result = getTrackingParams("/servicos/abrir-empresa");
    expect(result).toEqual({
      sourcePath: "/servicos/abrir-empresa",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "lancamento",
      utmTerm: "abrir empresa",
      utmContent: null,
      gclid: "abc",
      landingPage: "/servicos/abrir-empresa",
    });
  });

  it("mantém a origem da página de entrada depois que o visitante navega", () => {
    const storage = stubWindow("?utm_source=google&utm_campaign=troca", "/servicos/trocar-de-contador");
    getTrackingParams("/servicos/trocar-de-contador");

    stubWindow("", "/contato", storage);
    const result = getTrackingParams("/contato");
    expect(result.sourcePath).toBe("/contato");
    expect(result.utmSource).toBe("google");
    expect(result.utmCampaign).toBe("troca");
    expect(result.landingPage).toBe("/servicos/trocar-de-contador");
  });

  it("retorna null nos campos de UTM quando não há query string", () => {
    stubWindow("", "/contato");

    const result = getTrackingParams("/contato");
    expect(result.utmSource).toBeNull();
    expect(result.utmMedium).toBeNull();
    expect(result.utmCampaign).toBeNull();
    expect(result.gclid).toBeNull();
  });
});
