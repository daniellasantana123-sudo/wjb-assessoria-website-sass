import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { getObligationsForMonth } from "@/lib/obligations";
import { cn } from "@/lib/utils";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Calendário mensal das obrigações fiscais (SAAS FASE 3) — mesmo componente
 * usado no Portal (`/portal/calendario`) e no Admin (dentro do detalhe da
 * empresa), navegação por mês via querystring (`?year=&month=`, sem
 * JavaScript de cliente, mesmo padrão SSR do resto do site).
 */
export async function ObligationsCalendar({
  tenantId,
  year,
  month,
}: {
  tenantId: string;
  year: number;
  month: number;
}) {
  const obligations = await getObligationsForMonth(tenantId, year, month);

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);

  const obligationsByDay = new Map<number, typeof obligations>();
  for (const obligation of obligations) {
    const list = obligationsByDay.get(obligation.day) ?? [];
    list.push(obligation);
    obligationsByDay.set(obligation.day, list);
  }

  return (
    <div className="border-border overflow-hidden rounded-md border">
      <div className="border-border flex items-center justify-between border-b p-4">
        <Link
          href={`?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`}
          aria-label="Mês anterior"
          className="hover:bg-muted focus-visible:ring-primary flex h-9 w-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Link>
        <p className="text-foreground text-sm font-semibold">
          {monthNames[month - 1]} de {year}
        </p>
        <Link
          href={`?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`}
          aria-label="Próximo mês"
          className="hover:bg-muted focus-visible:ring-primary flex h-9 w-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-7 text-center">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-muted-foreground border-border border-b py-2 text-xs font-medium">
            {label}
          </div>
        ))}

        {Array.from({ length: totalCells }, (_, index) => {
          const dayNumber = index - startWeekday + 1;
          const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
          const dayObligations = inMonth ? (obligationsByDay.get(dayNumber) ?? []) : [];
          const isToday = isCurrentMonth && dayNumber === today.getDate();

          return (
            <div
              key={index}
              className={cn(
                "border-border min-h-20 border-b p-1.5 text-left sm:min-h-24 sm:p-2",
                (index + 1) % 7 !== 0 && "border-r",
                !inMonth && "bg-muted/20",
              )}
            >
              {inMonth && (
                <>
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                      isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {dayNumber}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayObligations.map((obligation) => (
                      <div
                        key={obligation.id}
                        title={obligation.title}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-xs",
                          obligation.status === "done" && "bg-success-bg text-success-text",
                          obligation.status === "pending" &&
                            !obligation.overdue &&
                            "bg-muted text-muted-foreground",
                          obligation.overdue && "bg-danger-bg text-danger-text",
                        )}
                      >
                        {obligation.title}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
