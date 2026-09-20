import { describe, expect, it } from "vitest";

import { getOmieGClickAdapter, isOmieConfigured } from "@/integrations/omie-gclick/provider";

/**
 * Fase 6.5 - BLOCKED_BY_PROVIDER. A implementação real (Fase 4) chamava a
 * API do Omie ERP por engano (confirmado incorreto via documentação
 * oficial - ver `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md`) e foi
 * removida. Estes testes garantem que o provider nunca volta a chamar
 * rede nenhuma silenciosamente - só o no-op, sempre.
 */
describe("getOmieGClickAdapter - BLOCKED_BY_PROVIDER", () => {
  it("isOmieConfigured() é sempre falso", () => {
    expect(isOmieConfigured()).toBe(false);
  });

  it("upsertClient nunca chama rede - resolve com erro sanitizado", async () => {
    const originalFetch = global.fetch;
    const fetchMock = () => {
      throw new Error("upsertClient não deveria chamar fetch");
    };
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await getOmieGClickAdapter().upsertClient({
        tenantId: "tenant-1",
        name: "Empresa X",
        cnpj: null,
      });
      expect(result).toEqual({ ok: false, error: "blocked-by-provider" });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("testConnection nunca chama rede - resolve com erro sanitizado", async () => {
    const originalFetch = global.fetch;
    const fetchMock = () => {
      throw new Error("testConnection não deveria chamar fetch");
    };
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await getOmieGClickAdapter().testConnection();
      expect(result).toEqual({ ok: false, error: "blocked-by-provider" });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
