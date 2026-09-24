import { describe, expect, it } from "vitest";

import type { ExternalTask } from "@/integrations/omie-gclick";
import {
  describeSyncResult,
  mapTaskStatus,
  planObligationSync,
} from "@/lib/obligations/external-sync";

const CLIENT = "gclick-cliente-1";
const TENANT = { clientExternalId: CLIENT, document: "35.673.259/0001-88" };

function task(overrides: Partial<ExternalTask> = {}): ExternalTask {
  return {
    externalId: "t1",
    clientExternalId: CLIENT,
    clientDocument: null,
    title: "Enviar DAS",
    status: "A",
    dueDate: "2026-10-20",
    ...overrides,
  };
}

describe("mapTaskStatus", () => {
  it("trata os status de trabalho em curso como pendente", () => {
    // A=Aberto, S=Solicitado, E=Retificando, P=Solicitado externo
    for (const status of ["A", "S", "E", "P"]) {
      expect(mapTaskStatus(status)).toBe("pending");
    }
  });

  it("trata concluído, finalizado e retificado como concluída", () => {
    for (const status of ["C", "F", "O"]) {
      expect(mapTaskStatus(status)).toBe("done");
    }
  });

  it("descarta cancelada e dispensada em vez de deixá-las pendentes", () => {
    // Mostrar isso ao cliente como pendência seria alarme falso permanente.
    expect(mapTaskStatus("X")).toBe("drop");
    expect(mapTaskStatus("D")).toBe("drop");
  });

  it("ignora caixa e espaços em volta", () => {
    expect(mapTaskStatus(" c ")).toBe("done");
    expect(mapTaskStatus("a")).toBe("pending");
  });

  it("status desconhecido vira pendente, nunca concluída", () => {
    // Concluída esconderia uma obrigação real do cliente; pendente, no
    // pior caso, mostra algo que ele já cumpriu - e ele questiona.
    expect(mapTaskStatus("Z")).toBe("pending");
    expect(mapTaskStatus("")).toBe("pending");
  });
});

describe("planObligationSync", () => {
  it("importa as tarefas do cliente com vencimento", () => {
    const plan = planObligationSync([task()], TENANT);
    expect(plan.upserts).toEqual([
      { externalId: "t1", title: "Enviar DAS", dueDate: "2026-10-20", status: "pending" },
    ]);
    expect(plan.removals).toEqual([]);
    expect(plan.skipped).toBe(0);
  });

  it("nunca importa tarefa de outro cliente", () => {
    // Barreira mais importante do arquivo: a API devolve as tarefas da
    // conta inteira, e sem esse filtro uma empresa veria a obrigação de outra.
    const plan = planObligationSync(
      [task({ externalId: "outro", clientExternalId: "gclick-cliente-2" })],
      TENANT,
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.removals).toEqual([]);
  });

  it("marca cancelada para remoção em vez de importar", () => {
    const plan = planObligationSync([task({ status: "X" })], TENANT);
    expect(plan.upserts).toEqual([]);
    expect(plan.removals).toEqual(["t1"]);
  });

  it("ignora tarefa sem vencimento em vez de inventar uma data", () => {
    const plan = planObligationSync([task({ dueDate: null })], TENANT);
    expect(plan.upserts).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("ignora tarefa sem título", () => {
    const plan = planObligationSync([task({ title: "" })], TENANT);
    expect(plan.upserts).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("ignora tarefa sem identificador externo", () => {
    const plan = planObligationSync([task({ externalId: "" })], TENANT);
    expect(plan.upserts).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("separa corretamente uma lista mista", () => {
    const plan = planObligationSync(
      [
        task({ externalId: "a", status: "A" }),
        task({ externalId: "b", status: "C" }),
        task({ externalId: "c", status: "X" }),
        task({ externalId: "d", dueDate: null }),
        task({ externalId: "e", clientExternalId: "outro-cliente" }),
      ],
      TENANT,
    );

    expect(plan.upserts.map((u) => u.externalId)).toEqual(["a", "b"]);
    expect(plan.upserts[1].status).toBe("done");
    expect(plan.removals).toEqual(["c"]);
    expect(plan.skipped).toBe(1);
  });

  it("aceita os status do provider mock, para o fluxo rodar em desenvolvimento", () => {
    const plan = planObligationSync(
      [task({ externalId: "m1", status: "open" }), task({ externalId: "m2", status: "completed" })],
      TENANT,
    );
    expect(plan.upserts.map((u) => u.status)).toEqual(["pending", "done"]);
  });
});

describe("describeSyncResult", () => {
  it("resume só o que aconteceu de fato", () => {
    expect(describeSyncResult({ created: 3, updated: 0, removed: 0, skipped: 0, examined: 3, matched: 3 })).toBe(
      "Obrigações sincronizadas: 3 criadas.",
    );
  });

  it("usa singular quando é uma só", () => {
    expect(describeSyncResult({ created: 1, updated: 0, removed: 0, skipped: 1, examined: 2, matched: 2 })).toBe(
      "Obrigações sincronizadas: 1 criada, 1 ignorada por falta de vencimento.",
    );
  });

  it("distingue 'o G-Click não devolveu nada' de 'nada era desta empresa'", () => {
    // Antes as duas situações caíam na mesma frase genérica, que não
    // ajudava ninguém a saber onde estava o problema.
    expect(
      describeSyncResult({ created: 0, updated: 0, removed: 0, skipped: 0, examined: 0, matched: 0 }),
    ).toContain("não retornou nenhuma tarefa");

    expect(
      describeSyncResult({ created: 0, updated: 0, removed: 0, skipped: 0, examined: 40, matched: 0 }),
    ).toContain("40 tarefas no G-Click, mas nenhuma está vinculada a esta empresa");
  });

  it("diz que já estava tudo em dia quando havia tarefas desta empresa sem mudança", () => {
    expect(
      describeSyncResult({ created: 0, updated: 0, removed: 0, skipped: 0, examined: 9, matched: 3 }),
    ).toContain("já estavam em dia");
  });
});

describe("planObligationSync - correlação por CNPJ", () => {
  it("aceita a tarefa quando o CNPJ bate, mesmo com id diferente", () => {
    // Acontece se o cliente foi revinculado no G-Click: o id guardado
    // envelhece, mas o CNPJ da empresa não muda.
    const plan = planObligationSync(
      [
        task({
          externalId: "t9",
          clientExternalId: "id-antigo",
          clientDocument: "35673259000188",
        }),
      ],
      TENANT,
    );
    expect(plan.upserts.map((u) => u.externalId)).toEqual(["t9"]);
    expect(plan.matched).toBe(1);
  });

  it("continua recusando empresa diferente, id e CNPJ", () => {
    const plan = planObligationSync(
      [
        task({
          externalId: "t9",
          clientExternalId: "outro",
          clientDocument: "11222333000181",
        }),
      ],
      TENANT,
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.matched).toBe(0);
    // `examined` conta tudo que veio da API, inclusive o que não é desta empresa.
    expect(plan.examined).toBe(1);
  });
});
