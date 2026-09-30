import { toIsoDate } from "@/lib/reports/period";
import type { ObligationNoticeKind, ObligationRef } from "@/lib/obligations/notices";

/** Quantos dias antes do vencimento sai o primeiro lembrete. */
export const REMINDER_DAYS_BEFORE = 3;

export interface ReminderRow {
  id: string;
  tenant_id: string;
  title: string;
  due_date: string;
}

export interface ReminderGroup {
  tenantId: string;
  kind: Extract<ObligationNoticeKind, "due_soon" | "due_today">;
  obligations: ObligationRef[];
}

/** As duas datas que interessam hoje: vence hoje e vence em N dias. */
export function reminderDates(today: Date): { today: string; soon: string } {
  const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + REMINDER_DAYS_BEFORE);
  return { today: toIsoDate(today), soon: toIsoDate(soon) };
}

/**
 * Agrupa as obrigações pendentes por empresa e por tipo de lembrete - um
 * aviso por empresa e por data, nunca um por obrigação.
 */
export function groupReminders(rows: ReminderRow[], dates: { today: string; soon: string }): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  for (const row of rows) {
    const kind = row.due_date === dates.today ? "due_today" : row.due_date === dates.soon ? "due_soon" : null;
    if (!kind) continue;
    const key = `${row.tenant_id}:${kind}`;
    const group = groups.get(key) ?? { tenantId: row.tenant_id, kind, obligations: [] };
    group.obligations.push({ id: row.id, title: row.title, dueDate: row.due_date });
    groups.set(key, group);
  }
  return [...groups.values()];
}
