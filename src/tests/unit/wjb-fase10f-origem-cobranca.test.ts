import { describe, expect, it } from "vitest";

import { blockedMessage, canChargeWithStripe, isValidServiceKey } from "@/lib/payments/billing-source";

describe("Fase 10F: uma única origem de cobrança ativa por serviço", () => {
  it("sem origem ativa: a Stripe pode cobrar", () => {
    expect(canChargeWithStripe([], "nfse_plano")).toEqual({ ok: true, alreadyStripe: false });
    expect(canChargeWithStripe([{ service_key: "nfse_plano", source: "omie", status: "encerrada" }], "nfse_plano")).toEqual({ ok: true, alreadyStripe: false });
  });
  it("origem ativa na Stripe: pode (idempotente)", () => {
    expect(canChargeWithStripe([{ service_key: "nfse_plano", source: "stripe", status: "ativa" }], "nfse_plano")).toEqual({ ok: true, alreadyStripe: true });
  });
  it("Omie ou outro meio ativos: recusa e explica", () => {
    const r = canChargeWithStripe([{ service_key: "nfse_plano", source: "omie", status: "ativa" }], "nfse_plano");
    expect(r).toEqual({ ok: false, activeSource: "omie" });
    expect(blockedMessage("omie")).toMatch(/já é cobrado por Omie/);
    expect(canChargeWithStripe([{ service_key: "nfse_plano", source: "externo", status: "ativa" }], "nfse_plano").ok).toBe(false);
  });
  it("outro serviço não interfere", () => {
    expect(canChargeWithStripe([{ service_key: "honorarios_contabeis", source: "omie", status: "ativa" }], "nfse_plano").ok).toBe(true);
  });
  it("lista fechada de serviços (igual ao CHECK da 0038)", () => {
    expect(isValidServiceKey("nfse_plano")).toBe(true);
    expect(isValidServiceKey("honorarios_contabeis")).toBe(true);
    expect(isValidServiceKey("servico_avulso:certidao_negativa")).toBe(true);
    expect(isValidServiceKey("servico_avulso:Abertura!")).toBe(false);
    expect(isValidServiceKey("qualquer")).toBe(false);
  });
});
