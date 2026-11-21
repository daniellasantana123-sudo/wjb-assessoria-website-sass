import { describe, expect, it } from "vitest";

import {
  ChannelNotConnectedError,
  getChannel,
} from "@/lib/wjb-ai/conversation/channels";
import {
  initialState,
  MAX_TURNS,
  nextTurn,
  sanitizeState,
  type ConversationState,
} from "@/lib/wjb-ai/conversation/engine";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";
import {
  filterList,
  paginate,
  parseListParams,
} from "@/lib/wjb-ai/fiscal/portal-list";
import {
  diffDrafts,
  slaState,
  sortForReview,
} from "@/lib/wjb-ai/fiscal/review-queue";

// Tudo FICTÍCIO.
const draft = (over: Partial<NormalizedNfseDraft> = {}): NormalizedNfseDraft =>
  ({
    serviceDescription: "Corte e escova",
    amountCents: 25000,
    competence: "2026-11",
    taker: {
      document: "52998224725",
      documentKind: "CPF",
      name: "Maria Fictícia",
    },
    ...over,
  }) as NormalizedNfseDraft;

describe("lista de solicitações do cliente", () => {
  const items = [
    {
      id: "1",
      status: "REVISAO_HUMANA",
      createdAt: "2026-11-20",
      draft: draft(),
    },
    {
      id: "2",
      status: "DADOS_PENDENTES",
      createdAt: "2026-11-19",
      draft: draft({ serviceDescription: "Consultoria de marketing" }),
    },
    {
      id: "3",
      status: "AUTORIZADA",
      createdAt: "2026-11-18",
      draft: draft({
        taker: {
          document: "11222333000181",
          documentKind: "CNPJ",
          name: "Padaria Fictícia",
        },
      }),
    },
  ] as const;
  it("filtra por grupo de status e busca sem acento", () => {
    expect(filterList([...items], "acao", "").map((i) => i.id)).toEqual(["2"]);
    expect(
      filterList([...items], "todas", "padaria ficticia").map((i) => i.id),
    ).toEqual(["3"]);
    expect(filterList([...items], "concluidas", "").map((i) => i.id)).toEqual([
      "3",
    ]);
  });
  it("paginação e parâmetros inválidos caem no padrão", () => {
    const many = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(many, 3)).toMatchObject({ page: 3, pages: 3, total: 45 });
    expect(paginate(many, 99).page).toBe(3);
    expect(
      parseListParams({ status: "hack", pagina: "-5", q: "x".repeat(200) }),
    ).toMatchObject({ group: "todas", page: 1 });
    expect(parseListParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("fila de revisão: prazo e versões", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  it("estado do prazo", () => {
    expect(slaState(null, "normal", now)).toBe("sem_prazo");
    expect(slaState("2026-11-21T11:00:00Z", "normal", now)).toBe("vencido");
    expect(slaState("2026-11-21T14:00:00Z", "normal", now)).toBe("vence_logo"); // 2 h de 24 h
    expect(slaState("2026-11-22T10:00:00Z", "normal", now)).toBe("no_prazo");
  });
  it("ordena pelo prazo, depois pela prioridade", () => {
    const rows = [
      {
        id: "a",
        priority: "normal",
        reviewDueAt: "2026-11-22T00:00:00Z",
        createdAt: "1",
      },
      {
        id: "b",
        priority: "urgente",
        reviewDueAt: "2026-11-21T13:00:00Z",
        createdAt: "2",
      },
      { id: "c", priority: "alta", reviewDueAt: null, createdAt: "3" },
    ];
    expect(sortForReview(rows).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("diferença entre versões, com documento sempre mascarado", () => {
    const changes = diffDrafts(
      draft(),
      draft({
        amountCents: 30000,
        taker: {
          document: "39053344705",
          documentKind: "CPF",
          name: "Maria Fictícia",
        },
      }),
    );
    expect(changes.map((c) => c.field)).toEqual([
      "Valor",
      "Documento do tomador",
    ]);
    expect(JSON.stringify(changes)).not.toMatch(/52998224725|39053344705/);
    expect(diffDrafts(draft(), draft())).toEqual([]);
  });
  it("máscara de CPF e CNPJ", () => {
    expect(maskDocument("529.982.247-25")).toBe("***.982.247-**");
    expect(maskDocument("11222333000181")).toBe("**.222.333/****-**");
  });
});

function talk(messages: string[], start: ConversationState = initialState()) {
  let s = start;
  const turns = [];
  for (const m of messages) {
    const t = nextTurn(s, m);
    turns.push(t);
    s = t.state;
  }
  return turns;
}

describe("atendente por regras (sem modelo externo)", () => {
  it("coleta incremental, confirma e só então fica pronto", () => {
    const t = talk([
      "Quero pedir uma nota",
      "Corte e escova",
      "250,00",
      "11/2026",
      "529.982.247-25",
      "Maria Fictícia",
      "sim",
    ]);
    expect(t[0].reply).toMatch(/Qual serviço/);
    expect(t[1].reply).toMatch(/valor/);
    expect(t[2].reply).toMatch(/mês/);
    expect(t[3].reply).toMatch(/CPF ou CNPJ/);
    expect(t[4].reply).toMatch(/nome/);
    expect(t[5].state.stage).toBe("confirmando");
    expect(t[5].reply).toContain("***.982.247-**");
    expect(t[5].reply).not.toContain("52998224725");
    expect(t.slice(0, 6).every((x) => !x.ready)).toBe(true);
    expect(t[6]).toMatchObject({ ready: true });
    expect(t[6].state.values).toMatchObject({
      grossAmount: "250.00",
      competence: "2026-11",
      takerDocument: "52998224725",
    });
  });
  it("aproveita o que vier na primeira mensagem", () => {
    const t = talk([
      "Preciso de uma nota fiscal de R$ 1.250,00 para Maria Fictícia CPF 529.982.247-25, serviço de consultoria, competência 2026-11",
    ]);
    expect(t[0].state.stage).toBe("confirmando");
  });
  it("documento inválido é perguntado de novo", () => {
    const t = talk([
      "Quero pedir uma nota",
      "Consultoria",
      "100",
      "11/2026",
      "123.456.789-00",
    ]);
    expect(t[4].reply).toMatch(/Não consegui entender.*CPF ou CNPJ/);
  });
  it("correção na confirmação volta só ao campo pedido", () => {
    const base = talk([
      "Quero pedir uma nota",
      "Consultoria",
      "100",
      "11/2026",
      "52998224725",
      "Maria Fictícia",
    ]);
    const fix = talk(["Corrigir o valor", "150,00"], base.at(-1)!.state);
    expect(fix[0].reply).toMatch(/valor/);
    expect(fix[1].state.stage).toBe("confirmando");
    expect(fix[1].state.values.grossAmount).toBe("150.00");
  });
  it("nunca escolhe código, alíquota ou regime: encaminha ao contador", () => {
    for (const q of [
      "Qual alíquota devo usar?",
      "qual o código de serviço?",
      "muda meu regime",
      "quero cancelar a nota",
      "nota de produto",
      "NF-e de mercadoria",
    ]) {
      const t = nextTurn(initialState(), q);
      expect(t, q).toMatchObject({ handoff: true, ready: false });
      expect(t.reply).toMatch(/contador/);
    }
  });
  it("mensagem fora do assunto não cria nada", () => {
    expect(nextTurn(initialState(), "bom dia")).toMatchObject({
      ready: false,
      handoff: false,
    });
  });
  it("conversa longa demais é encaminhada", () => {
    const s = { ...initialState(), turns: MAX_TURNS };
    expect(nextTurn(s, "oi").handoff).toBe(true);
  });
  it("estado vindo do navegador é saneado (não dá para pular a confirmação com campos inválidos)", () => {
    const forged = sanitizeState({
      stage: "pronto",
      asking: "x",
      turns: -3,
      values: {
        takerDocument: "529.982.247-25abc",
        grossAmount: "9".repeat(50),
      },
    });
    expect(forged.asking).toBeNull();
    expect(forged.turns).toBe(0);
    expect(forged.values.takerDocument).toBe("52998224725");
    expect(forged.values.grossAmount).toHaveLength(20);
    expect(sanitizeState("lixo").stage).toBe("inicio");
  });
});

describe("canais", () => {
  it("canal interno conectado; WhatsApp não envia nada nesta fase", async () => {
    expect(getChannel("portal_interno").connected).toBe(true);
    const wa = getChannel("whatsapp_business");
    expect(wa.connected).toBe(false);
    await expect(wa.send("x", "y")).rejects.toThrow(ChannelNotConnectedError);
  });
});
