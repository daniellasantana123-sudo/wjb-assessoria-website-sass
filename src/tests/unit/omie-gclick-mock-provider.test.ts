import { beforeEach, describe, expect, it } from "vitest";

import { createMockGClickProvider, type MockGClickProvider } from "@/integrations/omie-gclick/mock.provider";
import { MOCK_CLIENT_EXISTING } from "@/integrations/omie-gclick/fixtures";

/**
 * Testes específicos do `MockGClickProvider` (seções 7/8/9 do prompt da
 * Fase 6.5) - determinísticos (nenhum `Math.random`/timing real), cada
 * cenário trocado explicitamente via `setScenario()`.
 */
describe("MockGClickProvider", () => {
  let provider: MockGClickProvider;

  beforeEach(() => {
    provider = createMockGClickProvider();
  });

  it("já nasce com o cliente fixture pré-cadastrado (MOCK_CLIENT_EXISTING)", async () => {
    const found = await provider.clients.findById(MOCK_CLIENT_EXISTING.externalId as string);
    expect(found).toEqual({ ok: true, data: MOCK_CLIENT_EXISTING });
  });

  it("criar um cliente com referência já usada devolve DUPLICATE", async () => {
    const result = await provider.clients.create({
      internalId: "dup-tenant",
      externalReference: MOCK_CLIENT_EXISTING.externalReference,
      name: "Tentativa Duplicada LTDA",
      document: null,
    });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "DUPLICATE" }) });
  });

  it("atualizar um cliente inexistente devolve NOT_FOUND", async () => {
    const result = await provider.clients.update({ externalId: "nao-existe", name: "X" });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "NOT_FOUND" }) });
  });

  it("atualizar um cliente existente reflete as mudanças", async () => {
    const result = await provider.clients.update({
      externalId: MOCK_CLIENT_EXISTING.externalId as string,
      name: "Nome Atualizado LTDA",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Nome Atualizado LTDA");
  });

  it("createPreTask() devolve uma tarefa aberta vinculada ao cliente informado", async () => {
    const result = await provider.tasks.createPreTask({
      clientExternalId: MOCK_CLIENT_EXISTING.externalId as string,
      title: "Nova pré-tarefa de teste",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("open");
      expect(result.data.clientExternalId).toBe(MOCK_CLIENT_EXISTING.externalId);
    }
  });

  const scenarios = [
    ["AUTH_ERROR", "AUTHENTICATION_ERROR"],
    ["RATE_LIMIT", "RATE_LIMITED"],
    ["TIMEOUT", "TIMEOUT"],
    ["UNAVAILABLE", "UNAVAILABLE"],
    ["VALIDATION_ERROR", "VALIDATION_ERROR"],
  ] as const;

  it.each(scenarios)("cenário %s faz clients.create() falhar com %s", async (scenario, code) => {
    provider.setScenario(scenario);
    const result = await provider.clients.create({
      internalId: "t",
      externalReference: "ref-cenario",
      name: "Empresa Cenário",
      document: null,
    });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code }) });
  });

  it("RATE_LIMIT inclui retryAfterMs", async () => {
    provider.setScenario("RATE_LIMIT");
    const result = await provider.clients.list();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryAfterMs).toBeGreaterThan(0);
  });

  it("reset() volta ao cenário SUCCESS e ao estado inicial (só o fixture)", async () => {
    provider.setScenario("UNAVAILABLE");
    await provider.clients.create({
      internalId: "t2",
      externalReference: "ref-antes-do-reset",
      name: "Empresa X",
      document: null,
    });

    provider.reset();

    const afterReset = await provider.clients.list();
    expect(afterReset).toEqual({
      ok: true,
      data: { items: [MOCK_CLIENT_EXISTING], page: 1, pageSize: 20, total: 1 },
    });
  });

  it("getCapabilities() do mock libera tudo exceto os 2 recursos partner_only", () => {
    const capabilities = provider.getCapabilities();
    expect(capabilities.canCreateClients).toBe(true);
    expect(capabilities.canListTasks).toBe(true);
    expect(capabilities.canReplyActivity).toBe(false);
    expect(capabilities.canCreatePreTaskWithTag).toBe(false);
  });

  it("healthCheck() do mock é sempre 'available'", async () => {
    expect(await provider.healthCheck()).toEqual({ provider: "gclick", mode: "mock", status: "available" });
  });
});
