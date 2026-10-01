import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireStaffSession: requireStaffSessionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notifications", () => ({
  notifyIntegrationStatus: vi.fn(),
  notifyObligationEvent: vi.fn(),
}));

const listClientsMock = vi.fn();
vi.mock("@/integrations/omie-gclick", () => ({
  getOmieGClickAdapter: () => ({
    clients: { list: listClientsMock },
    catalog: { portfolio: vi.fn() },
  }),
  getGClickConfig: () => ({ mode: "mock" }),
}));

const tenantInsertMock = vi.fn();
const mappingUpsertMock = vi.fn().mockResolvedValue({ error: null });
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
let tenantsData: { id: string; cnpj: string | null }[] = [];
let mappingsData: { tenant_id: string; external_client_id: string | null }[] = [];

vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === "tenants") {
        return {
          select: () => Promise.resolve({ data: tenantsData }),
          insert: (row: unknown) => ({
            select: () => ({ single: () => tenantInsertMock(row) }),
          }),
        };
      }
      if (table === "omie_client_mappings") {
        return {
          select: () => Promise.resolve({ data: mappingsData }),
          upsert: mappingUpsertMock,
        };
      }
      if (table === "audit_log") return { insert: auditInsertMock };
      throw new Error(`tabela inesperada: ${table}`);
    },
  }),
}));

const { importGClickClients } = await import("@/actions/omie-gclick");

const gclickClients = [
  { externalId: "10", name: "MARIA DA SILVA COMERCIO LTDA", tradeName: "PIMPOLHA", document: "12345678000199" },
  { externalId: "11", name: "JOSE PADARIA ME", tradeName: null, document: "98765432000110" },
  { externalId: "12", name: "JA VINCULADA LTDA", tradeName: null, document: "11111111000111" },
];

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffSessionMock.mockResolvedValue({ userId: "staff-1", isWjbStaff: true, staffRole: "contador" });
  listClientsMock.mockResolvedValue({ ok: true, data: { items: gclickClients } });
  tenantInsertMock.mockResolvedValue({ data: { id: "tenant-novo" }, error: null });
  tenantsData = [{ id: "tenant-padaria", cnpj: "98.765.432/0001-10" }];
  mappingsData = [{ tenant_id: "tenant-x", external_client_id: "12" }];
});

describe("importGClickClients", () => {
  it("cliente novo vira empresa com nome fantasia e CNPJ formatado, já vinculada", async () => {
    const result = await importGClickClients(["10"]);

    expect(tenantInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "PIMPOLHA", cnpj: "12.345.678/0001-99" }),
    );
    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-novo", external_client_id: "10", status: "connected" }),
      expect.anything(),
    );
    expect(result).toMatchObject({ imported: 1, linked: 0, skipped: 0 });
  });

  it("mesmo CNPJ de uma empresa já cadastrada: só vincula, não cria outra", async () => {
    const result = await importGClickClients(["11"]);

    expect(tenantInsertMock).not.toHaveBeenCalled();
    expect(mappingUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-padaria", external_client_id: "11" }),
      expect.anything(),
    );
    expect(result).toMatchObject({ imported: 0, linked: 1 });
  });

  it("cliente já vinculado ou inexistente é ignorado", async () => {
    const result = await importGClickClients(["12", "999"]);

    expect(tenantInsertMock).not.toHaveBeenCalled();
    expect(mappingUpsertMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 0, linked: 0, skipped: 2 });
  });

  it("Atendimento não pode importar", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "staff-2", isWjbStaff: true, staffRole: "atendimento" });

    const result = await importGClickClients(["10"]);

    expect(result).toEqual({ error: expect.stringContaining("não permite") });
    expect(listClientsMock).not.toHaveBeenCalled();
  });
});
