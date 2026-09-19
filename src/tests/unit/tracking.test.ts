import { afterEach, describe, expect, it, vi } from "vitest";

import { getTrackingParams } from "@/lib/analytics/tracking";

describe("getTrackingParams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lê UTM params da URL atual", () => {
    vi.stubGlobal("window", {
      location: { search: "?utm_source=google&utm_medium=cpc&utm_campaign=lancamento" },
    });

    const result = getTrackingParams("/servicos/abrir-empresa");
    expect(result).toEqual({
      sourcePath: "/servicos/abrir-empresa",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "lancamento",
    });
  });

  it("retorna null nos campos de UTM quando não há query string", () => {
    vi.stubGlobal("window", { location: { search: "" } });

    const result = getTrackingParams("/contato");
    expect(result.utmSource).toBeNull();
    expect(result.utmMedium).toBeNull();
    expect(result.utmCampaign).toBeNull();
  });
});
