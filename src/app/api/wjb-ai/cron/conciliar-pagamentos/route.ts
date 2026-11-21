import { NextResponse, type NextRequest } from "next/server";

import { isPaymentsEnabled } from "@/lib/payments/config";
import { reconcilePayments } from "@/lib/payments/service";
import { isCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Conciliação de pagamentos (Fase 9.1). Protegida por CRON_SECRET (lido em
 * runtime). Só lê o provedor e atualiza o estado local; nunca cobra.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isPaymentsEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, ...(await reconcilePayments()) });
}
