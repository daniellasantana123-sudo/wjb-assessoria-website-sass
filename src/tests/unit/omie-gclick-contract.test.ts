import { beforeEach, describe, expect, it } from "vitest";

import { createMockGClickProvider, type MockGClickProvider } from "@/integrations/omie-gclick/mock.provider";
import type { OmieGClickAdapter } from "@/integrations/omie-gclick";

/**
 * Suíte de contrato (seção 29 do prompt da Fase 6.5 - "mocks e contratos
 * internos"): qualquer provider que implemente `OmieGClickAdapter`
 * precisa passar por estes mesmos testes. Hoje só roda contra
 * `MockGClickProvider`; quando `GClickHttpProvider` tiver uma
 * implementação real (contra sandbox), a mesma função pode ser chamada
 * de novo só trocando a factory - nenhum teste precisa ser reescrito.
 */
export function runProviderContractTests(label: string, createProvider: () => OmieGClickAdapter) {
  describe(`Contrato OmieGClickAdapter - ${label}`, () => {
    let provider: OmieGClickAdapter;

    beforeEach(() => {
      provider = createProvider();
    });

    it("healthCheck() devolve provider/mode/status", async () => {
      const health = await provider.healthCheck();
      expect(health.provider).toBe("gclick");
      expect(["mock", "sandbox", "production"]).toContain(health.mode);
      expect(["available", "not_configured", "unavailable"]).toContain(health.status);
    });

    it("getCapabilities() nunca libera partner_only", () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities.canReplyActivity).toBe(false);
      expect(capabilities.canCreatePreTaskWithTag).toBe(false);
    });

    it("clients.create() seguido de clients.findById() encontra o mesmo cliente", async () => {
      const created = await provider.clients.create({
        internalId: "contract-tenant-1",
        externalReference: "contract-ref-1",
        name: "Empresa Contrato LTDA",
        document: "00.000.000/0001-99",
      });

      if (!created.ok) return; // provider bloqueado (ex.: GClickHttpProvider) - nada a comparar.

      const found = await provider.clients.findById(created.data.externalId as string);
      expect(found.ok).toBe(true);
      if (found.ok) expect(found.data?.externalId).toBe(created.data.externalId);
    });

    it("clients.create() seguido de clients.findByExternalReference() encontra o mesmo cliente", async () => {
      const created = await provider.clients.create({
        internalId: "contract-tenant-2",
        externalReference: "contract-ref-2",
        name: "Outra Empresa LTDA",
        document: null,
      });

      if (!created.ok) return;

      const found = await provider.clients.findByExternalReference("contract-ref-2");
      expect(found.ok).toBe(true);
      if (found.ok) expect(found.data?.externalReference).toBe("contract-ref-2");
    });

    it("clients.list() devolve um PaginatedResult coerente", async () => {
      const result = await provider.clients.list();
      if (!result.ok) return;
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data.total).toBeGreaterThanOrEqual(result.data.items.length);
    });

    it("tasks.list() devolve um PaginatedResult coerente", async () => {
      const result = await provider.tasks.list();
      if (!result.ok) return;
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it("tasks.createPreTask() nunca lança, mesmo se o provider bloquear", async () => {
      await expect(
        provider.tasks.createPreTask({ clientExternalId: "any", title: "Tarefa de contrato" }),
      ).resolves.toBeDefined();
    });
  });
}

describe("MockGClickProvider cumpre o contrato", () => {
  runProviderContractTests("MockGClickProvider", (): MockGClickProvider => createMockGClickProvider());
});
