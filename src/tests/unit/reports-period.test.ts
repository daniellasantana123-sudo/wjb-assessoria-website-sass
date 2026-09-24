import { describe, expect, it } from "vitest";

import {
  buildMonthBuckets,
  buildReportCsv,
  periodRange,
  reportPeriods,
  resolvePeriod,
  type ReportMonthRow,
} from "@/lib/reports/period";

/** 24/09/2026 — meio do ano, para "ano atual" e "12 meses" não coincidirem. */
const reference = new Date(2026, 8, 24);

const period = (value: string) => reportPeriods.find((p) => p.value === value)!;

describe("resolvePeriod", () => {
  it("aceita os períodos conhecidos", () => {
    expect(resolvePeriod("3m").months).toBe(3);
    expect(resolvePeriod("12m").months).toBe(12);
  });

  it("cai no padrão de 6 meses para valor inválido ou ausente", () => {
    expect(resolvePeriod(undefined).value).toBe("6m");
    expect(resolvePeriod("").value).toBe("6m");
    // Valor arbitrário vindo da URL nunca deve virar período.
    expect(resolvePeriod("'; drop table obligations; --").value).toBe("6m");
  });
});

describe("buildMonthBuckets", () => {
  it("devolve os N meses até o mês atual, do mais antigo ao mais novo", () => {
    const buckets = buildMonthBuckets(period("3m"), reference);
    expect(buckets.map((b) => b.label)).toEqual(["jul/2026", "ago/2026", "set/2026"]);
  });

  it("atravessa a virada de ano sem quebrar", () => {
    const buckets = buildMonthBuckets(period("6m"), new Date(2026, 1, 10));
    expect(buckets.map((b) => b.label)).toEqual([
      "set/2025",
      "out/2025",
      "nov/2025",
      "dez/2025",
      "jan/2026",
      "fev/2026",
    ]);
  });

  it("'ano atual' começa em janeiro, não 12 meses atrás", () => {
    const buckets = buildMonthBuckets(period("ano"), reference);
    expect(buckets).toHaveLength(9);
    expect(buckets[0].label).toBe("jan/2026");
    expect(buckets[buckets.length - 1].label).toBe("set/2026");
  });

  it("em janeiro, 'ano atual' é um mês só", () => {
    const buckets = buildMonthBuckets(period("ano"), new Date(2026, 0, 5));
    expect(buckets.map((b) => b.label)).toEqual(["jan/2026"]);
  });
});

describe("periodRange", () => {
  it("vai do dia 1 do primeiro mês ao último dia do último mês", () => {
    const range = periodRange(buildMonthBuckets(period("3m"), reference));
    expect(range).toEqual({ start: "2026-07-01", end: "2026-09-30" });
  });

  it("acerta o último dia de fevereiro em ano bissexto", () => {
    const range = periodRange(buildMonthBuckets(period("3m"), new Date(2024, 1, 15)));
    expect(range.end).toBe("2024-02-29");
  });

  it("não desloca a data por causa de fuso horário", () => {
    // Regressão: `toISOString()` converteria para UTC e devolveria o dia
    // anterior em qualquer fuso negativo, incluindo o do Brasil.
    const range = periodRange(buildMonthBuckets(period("3m"), reference));
    expect(range.start.endsWith("-01")).toBe(true);
  });
});

describe("buildReportCsv", () => {
  const rows: ReportMonthRow[] = [
    {
      label: "ago/2026",
      obligationsTotal: 4,
      obligationsDone: 3,
      obligationsPending: 1,
      obligationsOverdue: 1,
      documents: 7,
      guias: 2,
    },
  ];

  it("usa ponto e vírgula e BOM, para o Excel em português abrir certo", () => {
    const csv = buildReportCsv(rows);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Mês;Obrigações no período;");
  });

  it("escreve uma linha por mês, na ordem recebida", () => {
    const csv = buildReportCsv(rows);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("ago/2026;4;3;1;1;7;2");
  });

  it("gera só o cabeçalho quando não há nenhum mês", () => {
    const lines = buildReportCsv([]).replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(1);
  });
});
