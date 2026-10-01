import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireStaffSession: requireStaffSessionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notifications", () => ({ notifyIntegrationStatus: vi.fn(), notifyObligationEvent: vi.fn() }));

const createPreTaskMock = vi.fn();
const listResponsiblesMock = vi.fn();
vi.mock("@/integrations/omie-gclick", () => ({
  getOmieGClickAdapter: () => ({
    clients: { listResponsibles: listResponsiblesMock },
    tasks: { createPreTask: createPreTaskMock },
  }),
  getGClickConfig: () => ({
    mode: "production",
    account: { departments: [{ id: 2, name: "Fiscal" }] },
  }),
}));

const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
let mapping: { external_client_id: string | null; status: string } | null;
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === "tenants") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "t1", name: "PIMPO2", cnpj: "61.471.405/0001-00" } }) }) }) };
      }
      if (table === "omie_client_mappings") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mapping }) }) }) };
      }
      if (table === "audit_log") return { insert: auditInsertMock };
      throw new Error(`tabela inesperada: ${table}`);
    },
  }),
}));

const { createGClickTask } = await import("@/actions/omie-gclick");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffSessionMock.mockResolvedValue({ userId: "s1", isWjbStaff: true, staffRole: "atendimento" });
  mapping = { external_client_id: "52", status: "synced" };
  listResponsiblesMock.mockResolvedValue({ ok: true, data: [{ externalId: "245", name: "Diego", role: "Fiscal", email: null }] });
  createPreTaskMock.mockResolvedValue({ ok: true, data: { externalId: "9001" } });
});

describe("createGClickTask", () => {
  it("Atendimento cria tarefa com o cliente do vínculo, departamento e responsável válidos", async () => {
    const result = await createGClickTask("t1", undefined, form({ title: "Conferir notas", description: "Setembro", departmentId: "2", responsibleId: "245" }));

    expect(createPreTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientExternalId: "52", departmentId: 2, responsibleId: "245", documents: ["61.471.405/0001-00"] }),
    );
    expect(auditInsertMock).toHaveBeenCalledWith(expect.objectContaining({ action: "integration.gclick_task_created" }));
    expect(result).toEqual({ success: expect.stringContaining("id 9001") });
  });

  it("recusa departamento fora da lista configurada", async () => {
    const result = await createGClickTask("t1", undefined, form({ title: "Conferir notas", departmentId: "99" }));
    expect(result).toEqual({ error: expect.stringContaining("departamento") });
    expect(createPreTaskMock).not.toHaveBeenCalled();
  });

  it("recusa responsável que não é do cliente", async () => {
    const result = await createGClickTask("t1", undefined, form({ title: "Conferir notas", departmentId: "2", responsibleId: "777" }));
    expect(result).toEqual({ error: expect.stringContaining("responsável") });
    expect(createPreTaskMock).not.toHaveBeenCalled();
  });

  it("empresa sem vínculo com o G-Click não cria tarefa", async () => {
    mapping = null;
    const result = await createGClickTask("t1", undefined, form({ title: "Conferir notas", departmentId: "2" }));
    expect(result).toEqual({ error: expect.stringContaining("Vincule") });
    expect(createPreTaskMock).not.toHaveBeenCalled();
  });
});
