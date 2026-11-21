import { NextResponse } from "next/server";

import { getVerifiedSession } from "@/lib/auth/dal";
import { toIsoDate } from "@/lib/reports/period";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { previewFiscalDraft } from "@/lib/wjb-ai/fiscal/preview";

/**
 * POST /api/wjb-ai/fiscal/drafts/preview (F1, módulo desligado por padrão).
 * Prévia de NFS-e sem gravação, sem transmissão e sem IA. Ver
 * docs/wjb-ai/08-API-CONTRACTS.md.
 */
export async function POST(request: Request) {
  if (!isWjbAiEnabled()) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const session = await getVerifiedSession();
  if (session && isRateLimited(`wjb-ai:${session.userId}`)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const tenant =
    session && !session.isWjbStaff
      ? await getActiveTenant(session.userId)
      : null;
  const result = await previewFiscalDraft({
    moduleEnabled: true,
    session,
    tenant,
    body,
    today: toIsoDate(new Date()),
  });
  return NextResponse.json(result.body, { status: result.status });
}
