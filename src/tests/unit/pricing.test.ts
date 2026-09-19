import { describe, expect, it } from "vitest";

import { calculatePrice, formatBRL, pricingConfig, PRICING_MODE } from "@/config/pricing";
import type { SimulationState } from "@/types/pricing";

/**
 * Todos os valores esperados abaixo vêm diretamente de
 * `Tabela_de_Precos_WJB_Simulador_SP_2026_Preenchida.xlsx` (coluna "Valor
 * efetivo" das abas Planos_Base/Regras_Preco/Adicionais) — conferidos
 * manualmente linha a linha contra a planilha antes de escrever o teste.
 */
const baseState: SimulationState = {
  regime: "simples",
  state: "SP",
  activity: "services",
  hasStateRegistration: "no",
  partners: "1",
  employees: "0",
  monthlyRevenue: "0-15000",
  specialSituations: [],
  addons: { invoiceIssuance: false, invoiceVolume: null, fiscalMonitor: false },
};

describe("calculatePrice", () => {
  it("está em modo automatic (matriz oficial da WJB aprovada e calibrada)", () => {
    expect(PRICING_MODE).toBe("automatic");
  });

  it("retorna null sem regime selecionado", () => {
    expect(calculatePrice({ ...baseState, regime: null })).toBeNull();
  });

  it("Cenário 1: MEI, serviços, sem funcionário -> piso do plano (R$ 120)", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "mei",
      partners: null,
      monthlyRevenue: null,
    });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(120);
    expect(estimate!.isFloorOnly).toBe(true);
  });

  it("Cenário 2: MEI com 1 funcionário -> R$ 120 + R$ 70 = R$ 190", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "mei",
      partners: null,
      monthlyRevenue: null,
      employees: "1",
    });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(190);
    expect(estimate!.isFloorOnly).toBe(false);
  });

  it("Cenário 3: Simples Nacional, serviços, baixo faturamento, sem funcionário -> piso (R$ 350)", () => {
    const estimate = calculatePrice(baseState);
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(350);
    expect(estimate!.isFloorOnly).toBe(true);
  });

  it("Cenário 4: Simples Nacional, comércio, com IE, 1 funcionário -> 350+150+100+0+80+0 = R$ 680", () => {
    const estimate = calculatePrice({
      ...baseState,
      activity: "commerce",
      hasStateRegistration: "yes",
      employees: "1",
    });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(680);
  });

  it("Cenário 5: Simples Nacional, faturamento maior (200.001-400.000) -> 350+1050 = R$ 1.400", () => {
    const estimate = calculatePrice({ ...baseState, monthlyRevenue: "200001-400000" });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(1400);
  });

  it("Cenário 6: Lucro Presumido, serviços -> piso do plano (R$ 700)", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "presumido",
      monthlyRevenue: "0-30000",
    });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(700);
    expect(estimate!.isFloorOnly).toBe(true);
  });

  it("Cenário 7: Lucro Presumido, 6-10 funcionários, faturamento maior -> 700+750+1100 = R$ 2.550", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "presumido",
      employees: "6-10",
      monthlyRevenue: "200001-400000",
    });
    expect(estimate!.requiresCustomQuote).toBe(false);
    expect(estimate!.amount).toBe(2550);
  });

  it("Cenário 8: atividade especial/complexa -> proposta personalizada (sem valor fechado)", () => {
    const estimate = calculatePrice({ ...baseState, activity: "other" });
    expect(estimate!.requiresCustomQuote).toBe(true);
    expect(estimate!.amount).toBeNull();
    expect(estimate!.customQuoteReason).toBeTruthy();
  });

  it("bloqueia automático quando alguma situação especial (Excecoes) é marcada", () => {
    const estimate = calculatePrice({ ...baseState, specialSituations: ["economic_group"] });
    expect(estimate!.requiresCustomQuote).toBe(true);
    expect(estimate!.amount).toBeNull();
  });

  it("bloqueia MEI com 2+ funcionários (fora do padrão automático do plano)", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "mei",
      partners: null,
      monthlyRevenue: null,
      employees: "2",
    });
    expect(estimate!.requiresCustomQuote).toBe(true);
  });

  it("bloqueia faturamento acima do teto automático (Simples > 400 mil)", () => {
    const estimate = calculatePrice({ ...baseState, monthlyRevenue: "400000+" });
    expect(estimate!.requiresCustomQuote).toBe(true);
  });

  it("bloqueia faturamento acima do teto automático (Presumido > 800 mil)", () => {
    const estimate = calculatePrice({
      ...baseState,
      regime: "presumido",
      monthlyRevenue: "800000+",
    });
    expect(estimate!.requiresCustomQuote).toBe(true);
  });

  it("bloqueia volume de notas fiscais acima de 100/mês", () => {
    const estimate = calculatePrice({
      ...baseState,
      addons: { invoiceIssuance: true, invoiceVolume: "100+", fiscalMonitor: false },
    });
    expect(estimate!.requiresCustomQuote).toBe(true);
  });

  it("soma corretamente os adicionais (NFS-e 31-60 notas + Monitor Fiscal)", () => {
    const estimate = calculatePrice({
      ...baseState,
      addons: { invoiceIssuance: true, invoiceVolume: "31-60", fiscalMonitor: true },
    });
    // 350 (base) + 299 (NFS-e 31-60) + 99 (Monitor Fiscal) = 748
    expect(estimate!.amount).toBe(748);
  });

  it("aplica o modificador de sócios correto por regime (5 ou mais)", () => {
    const simples = calculatePrice({ ...baseState, partners: "5+" });
    const presumido = calculatePrice({
      ...baseState,
      regime: "presumido",
      partners: "5+",
      monthlyRevenue: "0-30000",
    });
    expect(simples!.amount).toBe(350 + 250);
    expect(presumido!.amount).toBe(700 + 300);
  });

  it("usa o preço de entrada correto por regime", () => {
    expect(calculatePrice({ ...baseState, regime: "mei" })!.basePrice).toBe(
      pricingConfig.base.mei,
    );
    expect(calculatePrice({ ...baseState, regime: "presumido" })!.basePrice).toBe(
      pricingConfig.base.presumido,
    );
  });
});

describe("formatBRL", () => {
  it("formata valores em Real brasileiro", () => {
    expect(formatBRL(350)).toBe("R$ 350,00");
  });
});
