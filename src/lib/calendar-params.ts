type Param = string | string[] | undefined;

function parseIntInRange(value: Param, fallback: number, min: number, max: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/**
 * Ano/mês do calendário de obrigações vindos da URL (`?year=&month=`),
 * usado no Portal e no Admin. Valor fora da faixa cai no mês atual - antes
 * `?month=13` passava direto e o título mostrava "undefined de 2026".
 */
export function parseCalendarParams(
  params: { year?: Param; month?: Param },
  now: Date = new Date(),
): { year: number; month: number } {
  return {
    year: parseIntInRange(params.year, now.getFullYear(), 2000, 2100),
    month: parseIntInRange(params.month, now.getMonth() + 1, 1, 12),
  };
}
