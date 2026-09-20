import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireStaffSession: requireStaffSessionMock,
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const createClientMock = vi.fn();
const updateClientMock = vi.fn();
const healthCheckMock = vi.fn();
vi.mock("@/integrations/omie-gclick", () => ({
  getOmieGClickAdapter: () => ({
    clients: { create: createClientMock, update: updateClientMock },
    healthCheck: healthCheckMock,
  }),
  getGClickConfig: () => ({ mode: "mock" }),
}));

const isFeatureEnabledMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: isFeatureEnabledMock,
}));

const notifyIntegrationStatusMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications", () => ({
  notifyIntegrationStatus: notifyIntegrationStatusMock,
}));

const tenantsMaybeSingleMock = vi.fn();
const mappingMaybeSingleMock = vi.fn();
const mappingUpsertMock = vi.fn().mockResolvedValue({ error: null });
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "tenants") {
    return { select: () => ({ eq: () => ({ maybeSingle: tenantsMaybeSingleMock }) }) };
  }
  if (table === "omie_client_mappings") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: mappingMaybeSingleMock }) }),
      upsert: mappingUpsertMock,
    };
  }
  if (table === "audit_log") {
    return { insert: auditInsertMock };
  }
  throw new Error(`tabela inesperada: ${table}`);
});

vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const { saveOmieMapping, syncOmieClient, setOmieMappingDisabled, testOmieConnection } = await import(
  "@/actions/omie-gclick"
);

function staffSession(staffRole: "super_admin" | "contador" | "atendimento" | null = "contador") {
  return { userId: "staff-1", email: "staff@wjb.com.br", isWjbStaff: true, staffRole };
}

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffSessionMock.mockResolvedValue(staffSession());
  isFeatureEnabledMock.mockResolvedValue(true);
  mappingUpsertMock.mockResolvedValue({ error: null });
  auditInsertMock.mockResolvedValue({ error: null });
  tenantsMaybeSingleMock.mockResolvedValue({ data: { id: "tenant-1", name: "Empresa X", cnpj: "0" } });
  mappingMaybeSingleMock.mockResolvedValue({ data: null });
});

describe("saveOmieMapping", () => {
  it("rejeita staff sem permissão (sem staffRole)", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession(null));

    const result = await saveOmieMapping(
      "tenant-1",
      undefined,
      formData({ externalClientId: "1", externalPortalUrl: "" }),
    );

    expect(result).toEqual({ error: expect.stringContaining("permissão") });
    expect(mappingUpsertMock).not.toHaveBeenCalled();
  });

  it("rejeita link do Portal Contábil que não seja https", async () => {
    const result = await saveOmieMapping(
      "tenant-1",
      undefined,
      formData({ externalClientId: "", externalPortalUrl: "http://inseguro.com" }),
    );

    expect(result).toEqual({ error: expect.stringContaining("https://") });
    expect(mappingUpsertMock).not.toHaveBeenCalled();
  });

  it("com externalClientId preenchido, salva como 'connected' e grava auditoria", async () => {
    const result = await saveOmieMapping(
      "tenant-1",
      undefined,
      formData({ externalClientId: "123456", externalPortalUrl: "https://portal.example.com" }),
    );

    expect(result).toEqual({ success: expect.any(String) });
    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-1", status: "connected" }),
      { onConflict: "tenant_id" },
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "integration.omie_mapping_updated" }),
    );
  });

  it("só com link do portal (sem código de cliente), salva como 'pending'", async () => {
    await saveOmieMapping(
      "tenant-1",
      undefined,
      formData({ externalClientId: "", externalPortalUrl: "https://portal.example.com" }),
    );

    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
      expect.anything(),
    );
  });
});

describe("syncOmieClient", () => {
  it("rejeita staff sem permissão", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession(null));

    const result = await syncOmieClient("tenant-1");

    expect(result).toEqual({ error: expect.stringContaining("permissão") });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejeita quando a feature flag 'omie_gclick' está desativada (Fase 5)", async () => {
    isFeatureEnabledMock.mockResolvedValue(false);

    const result = await syncOmieClient("tenant-1");

    expect(result).toEqual({ error: expect.stringContaining("desativada") });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("404 quando a empresa não existe", async () => {
    tenantsMaybeSingleMock.mockResolvedValue({ data: null });

    const result = await syncOmieClient("tenant-inexistente");

    expect(result).toEqual({ error: expect.stringContaining("não encontrada") });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sem external_client_id salvo, chama clients.create() (nunca update)", async () => {
    createClientMock.mockResolvedValue({
      ok: true,
      data: { externalId: "999", externalReference: "wjb-tenant-tenant-1" },
    });

    const result = await syncOmieClient("tenant-1");

    expect(result).toEqual({ success: expect.any(String) });
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ internalId: "tenant-1", externalReference: "wjb-tenant-tenant-1" }),
    );
    expect(updateClientMock).not.toHaveBeenCalled();
  });

  it("com external_client_id já salvo, chama clients.update() (nunca create) - idempotência", async () => {
    mappingMaybeSingleMock.mockResolvedValue({ data: { external_client_id: "999" } });
    updateClientMock.mockResolvedValue({ ok: true, data: { externalId: "999" } });

    await syncOmieClient("tenant-1");

    expect(updateClientMock).toHaveBeenCalledWith(expect.objectContaining({ externalId: "999" }));
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sucesso: marca 'syncing' e depois 'synced', grava external_client_id e auditoria", async () => {
    createClientMock.mockResolvedValue({ ok: true, data: { externalId: "999" } });

    const result = await syncOmieClient("tenant-1");

    expect(result).toEqual({ success: expect.any(String) });
    expect(mappingUpsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenant_id: "tenant-1", status: "syncing" }),
      { onConflict: "tenant_id" },
    );
    expect(mappingUpsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "synced", external_client_id: "999" }),
      { onConflict: "tenant_id" },
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "integration.omie_sync_attempted", metadata: { ok: true, error: undefined } }),
    );
  });

  it("falha do provider: marca status 'error' com o código sanitizado, nunca lança", async () => {
    createClientMock.mockResolvedValue({
      ok: false,
      error: { code: "PROVIDER_NOT_CONFIGURED", message: "Integração real bloqueada." },
    });

    const result = await syncOmieClient("tenant-1");

    expect(result).toEqual({ error: expect.stringContaining("Integração real bloqueada") });
    expect(mappingUpsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "error", last_error: "PROVIDER_NOT_CONFIGURED" }),
      { onConflict: "tenant_id" },
    );
    expect(notifyIntegrationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ excludeActorId: "staff-1" }),
    );
  });
});

describe("setOmieMappingDisabled", () => {
  it("staff sem permissão não altera nada", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession(null));

    await setOmieMappingDisabled("tenant-1", true);

    expect(mappingUpsertMock).not.toHaveBeenCalled();
  });

  it("desativa a integração e grava auditoria", async () => {
    await setOmieMappingDisabled("tenant-1", true);

    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "disabled" }),
      { onConflict: "tenant_id" },
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "integration.omie_disabled" }),
    );
  });

  it("reativa como 'connected' quando já existe external_client_id salvo", async () => {
    mappingMaybeSingleMock.mockResolvedValue({ data: { external_client_id: "123" } });

    await setOmieMappingDisabled("tenant-1", false);

    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "connected" }),
      { onConflict: "tenant_id" },
    );
  });
});

describe("testOmieConnection", () => {
  it("rejeita staff sem permissão", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession(null));

    const result = await testOmieConnection();

    expect(result).toEqual({ error: expect.stringContaining("permissão") });
    expect(healthCheckMock).not.toHaveBeenCalled();
  });

  it("sucesso (modo mock): grava auditoria e retorna confirmação", async () => {
    healthCheckMock.mockResolvedValue({ provider: "gclick", mode: "mock", status: "available" });

    const result = await testOmieConnection();

    expect(result).toEqual({ success: expect.stringContaining("mock") });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "integration.omie_connection_tested",
        metadata: { ok: true, mode: "mock", status: "available" },
      }),
    );
  });

  it("not_configured (provider real bloqueado): erro claro, nunca lança", async () => {
    healthCheckMock.mockResolvedValue({ provider: "gclick", mode: "production", status: "not_configured" });

    const result = await testOmieConnection();

    expect(result).toEqual({ error: expect.stringContaining("validação técnica oficial") });
  });
});
