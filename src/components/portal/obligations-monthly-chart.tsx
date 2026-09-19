import type { MonthlyObligationCount } from "@/lib/tenant";
import { cn } from "@/lib/utils";

/**
 * Barras empilhadas (concluída/pendente) por mês — só contagens reais de
 * `obligations.due_date` (ver `getObligationsMonthlyBreakdown`), nunca uma
 * tendência inventada. Sem lib de gráfico: são só divs proporcionais ao
 * maior total do período, com `title` nativo fazendo as vezes de tooltip.
 */
export function ObligationsMonthlyChart({ months }: { months: MonthlyObligationCount[] }) {
  const maxTotal = Math.max(...months.map((m) => m.total), 1);
  const grandTotal = months.reduce((sum, m) => sum + m.total, 0);

  if (grandTotal === 0) {
    return (
      <p className="text-muted-foreground flex h-48 items-center justify-center text-sm">
        Nenhuma obrigação cadastrada neste período.
      </p>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Obrigações por mês: ${months.map((m) => `${m.label} ${m.total}`).join(", ")}`}
      className="flex h-48 items-end gap-2 sm:gap-4"
    >
      {months.map((m) => {
        const doneHeight = (m.done / maxTotal) * 100;
        const pendingHeight = ((m.total - m.done) / maxTotal) * 100;
        return (
          <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="flex w-full max-w-10 flex-1 flex-col-reverse justify-start"
              title={`${m.label}: ${m.total} obrigação${m.total === 1 ? "" : "ões"} (${m.done} concluída${m.done === 1 ? "" : "s"})`}
            >
              {m.total === 0 ? (
                <div className="bg-muted h-1 w-full rounded-full" />
              ) : (
                <>
                  <div
                    className={cn("w-full rounded-t-sm", m.isCurrent ? "bg-primary" : "bg-primary/55")}
                    style={{ height: `${Math.max(doneHeight, doneHeight > 0 ? 4 : 0)}%` }}
                  />
                  <div
                    className={cn("w-full", m.isCurrent ? "bg-primary/25" : "bg-primary/15")}
                    style={{ height: `${Math.max(pendingHeight, pendingHeight > 0 ? 4 : 0)}%` }}
                  />
                </>
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                m.isCurrent ? "text-primary" : "text-muted-foreground",
              )}
            >
              {m.total}
            </span>
            <span
              className={cn(
                "text-xs uppercase",
                m.isCurrent ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
