import { NextResponse } from "next/server";

import { isCommercialEnabled } from "@/lib/commercial/config";
import { getPublicEmissionCatalog } from "@/lib/commercial/repo";

/**
 * Catálogo público da emissão de notas (Fase 9): só planos APROVADOS e o
 * desconto do combo, para a assistente do site. Sem dado de cliente.
 * 404 com a comercialização desligada.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isCommercialEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const catalog = await getPublicEmissionCatalog();
    return NextResponse.json(
      { ok: true, plans: catalog.plans.map(({ sku, name, monthlyCents, quota, overageCents }) => ({ sku, name, monthlyCents, quota, overageCents })), comboDiscountBp: catalog.comboDiscountBp },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
