import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseDepartments } = await import("@/integrations/omie-gclick/config");
const { toCreatePreTaskPayload } = await import("@/integrations/omie-gclick/mappers/task.mapper");

describe("parseDepartments", () => {
  it("lê id:nome separados por ponto e vírgula, vírgula ou linha", () => {
    expect(parseDepartments("1:Fiscal;2:Contábil, 3 = Pessoal", null)).toEqual([
      { id: 1, name: "Fiscal" },
      { id: 2, name: "Contábil" },
      { id: 3, name: "Pessoal" },
    ]);
  });

  it("ignora item sem id numérico e inclui o departamento padrão antigo", () => {
    expect(parseDepartments("Fiscal;2:Contábil", 9)).toEqual([
      { id: 2, name: "Contábil" },
      { id: 9, name: "Departamento padrão" },
    ]);
  });

  it("sem nada configurado, lista vazia", () => {
    expect(parseDepartments(undefined, null)).toEqual([]);
  });
});

describe("toCreatePreTaskPayload", () => {
  const config = { account: { departamentoId: null } } as never;

  it("manda departamento escolhido, responsável e CNPJ só com dígitos", () => {
    expect(
      toCreatePreTaskPayload(
        {
          clientExternalId: "52",
          title: "Conferir notas",
          description: "Notas de setembro",
          departmentId: 2,
          responsibleId: "245",
          documents: ["61.471.405/0001-00"],
        },
        config,
      ),
    ).toEqual({
      departamentoId: 2,
      assunto: "Conferir notas",
      andamento: "Notas de setembro",
      clienteId: "52",
      responsavelId: "245",
      inscricoes: ["61471405000100"],
    });
  });

  it("sem descrição repete o assunto; sem departamento nenhum, não monta (null)", () => {
    expect(toCreatePreTaskPayload({ clientExternalId: "1", title: "X", departmentId: 1 }, config)).toMatchObject({
      andamento: "X",
    });
    expect(toCreatePreTaskPayload({ clientExternalId: "1", title: "X" }, config)).toBeNull();
  });
});
