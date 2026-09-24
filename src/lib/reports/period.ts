/**
 * Lógica de período dos Relatórios do Portal (2026-09-24).
 *
 * Fica separada de `@/lib/tenant` de propósito: aqui não há nenhuma
 * consulta ao banco, só aritmética de data e serialização - o que permite
 * testar o cálculo de faixa, a montagem dos meses e o CSV sem subir
 * Supabase nenhum. Quem fala com o banco é `getTenantPeriodReport()`.
 */

export type ReportPeriodValue = "3m" | "6m" | "12m" | "ano";

export interface ReportPeriod {
  value: ReportPeriodValue;
  label: string;
  /** Quantos meses o período cobre, contando o mês atual. */
  months: number;
}

export const reportPeriods: ReportPeriod[] = [
  { value: "3m", label: "Últimos 3 meses", months: 3 },
  { value: "6m", label: "Últimos 6 meses", months: 6 },
  { value: "12m", label: "Últimos 12 meses", months: 12 },
  { value: "ano", label: "Ano atual", months: 0 },
];

export const defaultPeriod: ReportPeriodValue = "6m";

/** Traduz o `?periodo=` da URL num período conhecido - nunca confia no valor cru. */
export function resolvePeriod(raw: string | undefined): ReportPeriod {
  const match = reportPeriods.find((period) => period.value === raw);
  return match ?? reportPeriods.find((p) => p.value === defaultPeriod)!;
}

export interface MonthBucket {
  year: number;
  /** 0-11, como `Date.getMonth()`. */
  month: number;
  /** "set/2026" - rótulo curto pra tabela e CSV. */
  label: string;
}

const monthLabels = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Os meses que o período cobre, do mais antigo ao mês atual (inclusive).
 *
 * "Ano atual" começa em janeiro do ano de `reference`, e não 12 meses
 * atrás - são coisas diferentes em qualquer mês que não seja dezembro, e
 * confundir as duas é o erro clássico de relatório fiscal.
 */
export function buildMonthBuckets(
  period: ReportPeriod,
  reference: Date = new Date(),
): MonthBucket[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const count = period.value === "ano" ? month + 1 : period.months;

  const buckets: MonthBucket[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const d = new Date(year, month - offset, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${monthLabels[d.getMonth()]}/${d.getFullYear()}`,
    });
  }
  return buckets;
}

/** Primeiro e último dia do período, em `YYYY-MM-DD` (formato de `date` do Postgres). */
export function periodRange(buckets: MonthBucket[]): { start: string; end: string } {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const start = new Date(first.year, first.month, 1);
  // Dia 0 do mês seguinte = último dia do mês corrente, sem tabela de dias.
  const end = new Date(last.year, last.month + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/**
 * `YYYY-MM-DD` no fuso local.
 *
 * `toISOString()` converteria para UTC antes de cortar, o que joga a data
 * um dia para trás em qualquer fuso negativo - inclusive o do Brasil. Uma
 * obrigação que vence no dia 1 cairia no mês anterior do relatório.
 */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ReportMonthRow {
  label: string;
  obligationsTotal: number;
  obligationsDone: number;
  obligationsPending: number;
  obligationsOverdue: number;
  documents: number;
  guias: number;
}

/**
 * CSV do relatório, separado por ponto e vírgula e com BOM.
 *
 * Os dois detalhes são para o Excel em português: ele usa `;` como
 * separador padrão quando o sistema é pt-BR, e sem o BOM abre o arquivo em
 * Latin-1, transformando "Obrigações" em "ObrigaÃ§Ãµes". Sem isso o arquivo
 * "abre errado" e o relatório parece quebrado, mesmo estando correto.
 */
export function buildReportCsv(rows: ReportMonthRow[]): string {
  const header = [
    "Mês",
    "Obrigações no período",
    "Concluídas",
    "Pendentes",
    "Atrasadas",
    "Documentos recebidos",
    "Guias recebidas",
  ];

  const lines = [
    header.join(";"),
    ...rows.map((row) =>
      [
        row.label,
        row.obligationsTotal,
        row.obligationsDone,
        row.obligationsPending,
        row.obligationsOverdue,
        row.documents,
        row.guias,
      ].join(";"),
    ),
  ];

  return `﻿${lines.join("\r\n")}\r\n`;
}
