import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { loadClientGClickTasks } = await import("@/lib/integrations/gclick-client-tasks");
const { gclickTaskStatus, formatCompetence, formatGClickDate } = await import("@/lib/integrations/gclick-task-status");

describe("status de tarefa do G-Click", () => {
  it("traduz os códigos da documentação", () => {
    expect(gclickTaskStatus("A")).toMatchObject({ label: "Aberta", open: true });
    expect(gclickTaskStatus("c")).toMatchObject({ label: "Concluída", open: false });
    expect(gclickTaskStatus("X")).toMatchObject({ label: "Cancelada", open: false });
    expect(gclickTaskStatus("Z")).toMatchObject({ label: "Z", tone: "neutral" });
  });

  it("formata datas e competência", () => {
    expect(formatGClickDate("2026-09-30")).toBe("30/09/2026");
    expect(formatCompetence("2026-09-01")).toBe("09/2026");
    expect(formatGClickDate(null)).toBeNull();
  });
});

describe("tarefas de um cliente", () => {
  const task = (id: string, client: string | null, doc: string | null, due: string) => ({
    externalId: id, clientExternalId: client, clientDocument: doc, title: id, status: "A", dueDate: due,
  });

  it("junta obrigações e solicitações do cliente, por id ou CNPJ, da mais recente para a mais antiga", async () => {
    const adapter = {
      tasks: {
        list: vi.fn(async ({ category }: { category: string }) => ({
          ok: true,
          data: {
            items:
              category === "Obrigacao"
                ? [task("o1", "52", null, "2026-09-10"), task("o2", "99", null, "2026-09-20")]
                : [task("s1", null, "61471405000100", "2026-10-01")],
          },
        })),
      },
    } as never;

    const result = await loadClientGClickTasks(adapter, { externalId: "52", document: "61.471.405/0001-00" });

    expect(result.ok && result.tasks.map((t) => [t.externalId, t.category])).toEqual([
      ["s1", "Solicitacao"],
      ["o1", "Obrigacao"],
    ]);
  });

  it("G-Click fora do ar nas duas categorias vira erro, sem lançar", async () => {
    const adapter = {
      tasks: { list: vi.fn(async () => ({ ok: false, error: { code: "PROVIDER_UNAVAILABLE", message: "fora do ar" } })) },
    } as never;
    expect(await loadClientGClickTasks(adapter, { externalId: "52", document: null })).toEqual({ ok: false, message: "fora do ar" });
  });
});
