import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface CalendarObligation {
  id: string;
  title: string;
  day: number;
  status: "pending" | "done";
  overdue: boolean;
}

/** Obrigações com vencimento dentro de um mês (1-indexado) — pro Calendário. */
export async function getObligationsForMonth(
  tenantId: string,
  year: number,
  month: number,
): Promise<CalendarObligation[]> {
  const supabase = await createClient();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("obligations")
    .select("id, title, due_date, status")
    .eq("tenant_id", tenantId)
    .gte("due_date", start.toISOString().slice(0, 10))
    .lte("due_date", end.toISOString().slice(0, 10))
    .order("due_date", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    day: new Date(row.due_date + "T00:00:00").getDate(),
    status: row.status,
    overdue: row.status === "pending" && row.due_date < today,
  }));
}
