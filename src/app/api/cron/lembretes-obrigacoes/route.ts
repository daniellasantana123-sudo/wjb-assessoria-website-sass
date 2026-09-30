import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { notifyObligationEvent } from "@/lib/notifications";
import { groupReminders, reminderDates, type ReminderRow } from "@/lib/obligations/reminders";

/**
 * Lembrete diário de vencimento (2026-09-30, decisão do usuário). Chamado
 * uma vez por dia por um agendador externo (GitHub Actions,
 * `.github/workflows/lembretes-obrigacoes.yml`) com
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Avisa os membros de cada empresa sobre obrigações PENDENTES que vencem
 * hoje ou daqui a 3 dias. Idempotente: se o agendador chamar duas vezes no
 * mesmo dia, o segundo disparo não repete aviso (confere a notificação já
 * gravada com a mesma data e tipo).
 *
 * `CRON_SECRET` lido em tempo de execução (acesso por índice), pelo mesmo
 * motivo das outras variáveis desta hospedagem.
 */
export async function POST(request: NextRequest) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  const dates = reminderDates(new Date());
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("obligations")
    .select("id, tenant_id, title, due_date, tenants!inner(status)")
    .eq("status", "pending")
    .in("due_date", [dates.today, dates.soon])
    .neq("tenants.status", "suspended");

  if (error) {
    console.error("[cron/lembretes] falha ao buscar obrigações:", error);
    return NextResponse.json({ ok: false, error: "falha ao buscar obrigações" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  for (const group of groupReminders((rows ?? []) as ReminderRow[], dates)) {
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", group.tenantId)
      .eq("type", "obligation.due_soon")
      .contains("metadata_sanitized", { reminder_date: dates.today, reminder_kind: group.kind });

    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }

    await notifyObligationEvent({
      tenantId: group.tenantId,
      actorId: null,
      kind: group.kind,
      obligations: group.obligations,
      metadata: { reminder_date: dates.today, reminder_kind: group.kind },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, date: dates.today, sent, skipped });
}
