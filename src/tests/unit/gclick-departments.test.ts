import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let configured: { id: number; name: string }[] = [];
vi.mock("@/integrations/omie-gclick", () => ({
  getGClickConfig: () => ({ account: { departments: configured } }),
}));

const { fromExternalPayload } = await import("@/integrations/omie-gclick/mappers/task.mapper");
const { discoverGClickDepartments, getTaskDepartments } = await import("@/lib/integrations/gclick-departments");

describe("departamento da tarefa", () => {
  it("lê obrigacao.departamento (formato da resposta oficial)", () => {
    const task = fromExternalPayload({ id: "4.1", obrigacao: { departamento: { id: 4, nome: "Administrativo" } } });
    expect(task.department).toEqual({ id: 4, name: "Administrativo" });
  });

  it("sem departamento, fica nulo", () => {
    expect(fromExternalPayload({ id: "1" }).department).toBeNull();
  });
});

function fakeAdapter(byCategory: Record<string, { department: { id: number; name: string } | null }[]>) {
  return {
    tasks: {
      list: vi.fn(async ({ category }: { category: string }) => ({
        ok: true,
        data: { items: byCategory[category] ?? [] },
      })),
    },
  } as never;
}

describe("descoberta de departamentos", () => {
  it("junta os departamentos das obrigações e solicitações, sem repetir, em ordem alfabética", async () => {
    const adapter = fakeAdapter({
      Obrigacao: [{ department: { id: 4, name: "Fiscal" } }, { department: { id: 4, name: "Fiscal" } }, { department: null }],
      Solicitacao: [{ department: { id: 7, name: "Contábil" } }],
    });
    expect(await discoverGClickDepartments(adapter)).toEqual([
      { id: 7, name: "Contábil" },
      { id: 4, name: "Fiscal" },
    ]);
  });

  it("GCLICK_DEPARTAMENTOS configurado tem prioridade sobre a descoberta", async () => {
    configured = [{ id: 1, name: "Só este" }];
    const adapter = fakeAdapter({ Obrigacao: [{ department: { id: 4, name: "Fiscal" } }] });
    expect(await getTaskDepartments(adapter)).toEqual({ departments: [{ id: 1, name: "Só este" }], source: "config" });
    configured = [];
  });
});
