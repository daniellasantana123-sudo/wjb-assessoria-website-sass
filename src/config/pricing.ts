import type {
  Activity,
  Employees,
  InvoiceVolume,
  MonthlyRevenue,
  Partners,
  PriceEstimate,
  PricingMode,
  Regime,
  SimulationState,
  SpecialSituation,
  StateRegistration,
} from "@/types/pricing";

/**
 * Motor de preços do simulador de honorários.
 *
 * Fonte oficial: `Tabela_de_Precos_WJB_Simulador_SP_2026_Preenchida.xlsx`
 * (2026-09-05, fornecida pela WJB), sempre a coluna "Valor efetivo" de cada
 * aba (Planos_Base, Regras_Preco, Adicionais) — essa coluna já reflete o
 * "Valor WJB aprovado" quando preenchido (todas as linhas usadas aqui estão
 * com status "APROVADO" na planilha). Nenhum valor abaixo foi inventado.
 *
 * `null` num modificador tem um significado específico: a combinação está
 * marcada como "Bloqueia automático? = 1" / status "PROPOSTA PERSONALIZADA"
 * na planilha — `calculatePrice` trata isso como pedido de proposta
 * personalizada, nunca como "custo zero" (ver `blockReason` abaixo).
 *
 * Para alterar preços no futuro, a WJB só precisa editar os números neste
 * arquivo (nunca precisa mexer em componentes) — ver seção "Manutenção
 * futura dos preços" do prompt de implementação.
 */
export const PRICING_MODE: PricingMode = "automatic";

/**
 * Regras_Preco, categoria "Sócios" — só existe para simples/presumido na
 * planilha (MEI não admite sócios, por isso nem pergunta essa etapa).
 * Tipada à parte (em vez de `satisfies` inline) para que `pricingConfig
 * .partnerModifiers[regime]` aceite indexação por qualquer `Regime`,
 * incluindo "mei" (resultando em `undefined`, tratado em `calculatePrice`).
 */
const partnerModifiers: Partial<Record<Regime, Record<Partners, number>>> = {
  simples: { "1": 0, "2": 50, "3": 100, "4": 150, "5+": 250 },
  presumido: { "1": 0, "2": 60, "3": 120, "4": 180, "5+": 300 },
};

/**
 * Regras_Preco, categoria "Faturamento" — só existe para simples/presumido
 * (MEI não tem linha de faturamento na planilha). As faixas em si diferem
 * entre os dois regimes (ver `simplesRevenueOptions`/`presumidoRevenueOptions`).
 */
const revenueModifiers: Partial<Record<Regime, Partial<Record<MonthlyRevenue, number | null>>>> = {
  simples: {
    "0-15000": 0,
    "15001-30000": 100,
    "30001-60000": 250,
    "60001-100000": 450,
    "100001-200000": 700,
    "200001-400000": 1050,
    "400000+": null,
  },
  presumido: {
    "0-30000": 0,
    "30001-60000": 200,
    "60001-100000": 400,
    "100001-200000": 700,
    "200001-400000": 1100,
    "400001-800000": 1700,
    "800000+": null,
  },
};

export const pricingConfig = {
  /** Planos_Base, coluna "Valor efetivo". */
  base: {
    mei: 120,
    simples: 350,
    presumido: 700,
  } satisfies Record<Regime, number>,

  /** Regras_Preco, categoria "Atividade". */
  activityModifiers: {
    mei: { services: 0, commerce: 30, mixed: 50, industry: 60, other: null },
    simples: { services: 0, commerce: 150, mixed: 220, industry: 350, other: null },
    presumido: { services: 0, commerce: 250, mixed: 350, industry: 650, other: null },
  } satisfies Record<Regime, Record<Activity, number | null>>,

  /** Regras_Preco, categoria "Inscrição Estadual". */
  stateRegistrationModifiers: {
    mei: { no: 0, yes: 30, unknown: 0 },
    simples: { no: 0, yes: 100, unknown: 0 },
    presumido: { no: 0, yes: 150, unknown: 0 },
  } satisfies Record<Regime, Record<StateRegistration, number>>,

  partnerModifiers,

  /** Regras_Preco, categoria "Funcionários". */
  employeeModifiers: {
    mei: { "0": 0, "1": 70, "2": null, "3-5": null, "6-10": null, "11-20": null, "20+": null },
    simples: {
      "0": 0,
      "1": 80,
      "2": 160,
      "3-5": 320,
      "6-10": 650,
      "11-20": 1200,
      "20+": null,
    },
    presumido: {
      "0": 0,
      "1": 90,
      "2": 180,
      "3-5": 360,
      "6-10": 750,
      "11-20": 1400,
      "20+": null,
    },
  } satisfies Record<Regime, Record<Employees, number | null>>,

  revenueModifiers,

  /** Adicionais. */
  addons: {
    invoiceIssuance: {
      enabled: true,
      tiers: {
        "1-10": 79,
        "11-30": 159,
        "31-60": 299,
        "61-100": 499,
        "100+": null,
      } satisfies Record<InvoiceVolume, number | null>,
    },
    fiscalMonitor: {
      enabled: true,
      monthlyPrice: 99,
    },
  },
};

export const activityOptions: { value: Activity; label: string }[] = [
  { value: "services", label: "Prestação de serviços" },
  { value: "commerce", label: "Comércio" },
  { value: "mixed", label: "Serviços + Comércio" },
  { value: "industry", label: "Indústria" },
  { value: "other", label: "Atividade especial / complexa" },
];

export const meiEmployeeOptions: { value: Employees; label: string }[] = [
  { value: "0", label: "Não" },
  { value: "1", label: "Sim, 1 empregado" },
];

export const employeeOptions: { value: Employees; label: string }[] = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3-5", label: "3 a 5" },
  { value: "6-10", label: "6 a 10" },
  { value: "11-20", label: "11 a 20" },
  { value: "20+", label: "Mais de 20" },
];

export const partnerOptions: { value: Partners; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5+", label: "5 ou mais" },
];

/** Simples Nacional — Regras_Preco, categoria "Faturamento". */
export const simplesRevenueOptions: { value: MonthlyRevenue; label: string }[] = [
  { value: "0-15000", label: "Até R$ 15.000" },
  { value: "15001-30000", label: "R$ 15.001 a R$ 30.000" },
  { value: "30001-60000", label: "R$ 30.001 a R$ 60.000" },
  { value: "60001-100000", label: "R$ 60.001 a R$ 100.000" },
  { value: "100001-200000", label: "R$ 100.001 a R$ 200.000" },
  { value: "200001-400000", label: "R$ 200.001 a R$ 400.000" },
  { value: "400000+", label: "Acima de R$ 400.000" },
];

/** Lucro Presumido — Regras_Preco, categoria "Faturamento" (faixas maiores que o Simples). */
export const presumidoRevenueOptions: { value: MonthlyRevenue; label: string }[] = [
  { value: "0-30000", label: "Até R$ 30.000" },
  { value: "30001-60000", label: "R$ 30.001 a R$ 60.000" },
  { value: "60001-100000", label: "R$ 60.001 a R$ 100.000" },
  { value: "100001-200000", label: "R$ 100.001 a R$ 200.000" },
  { value: "200001-400000", label: "R$ 200.001 a R$ 400.000" },
  { value: "400001-800000", label: "R$ 400.001 a R$ 800.000" },
  { value: "800000+", label: "Acima de R$ 800.000" },
];

export function getRevenueOptions(regime: Regime | null) {
  return regime === "presumido" ? presumidoRevenueOptions : simplesRevenueOptions;
}

export const invoiceVolumeOptions: { value: InvoiceVolume; label: string }[] = [
  { value: "1-10", label: "Até 10" },
  { value: "11-30", label: "11 a 30" },
  { value: "31-60", label: "31 a 60" },
  { value: "61-100", label: "61 a 100" },
  { value: "100+", label: "Mais de 100" },
];

/** Excecoes — situações que tiram o perfil do cálculo automático. */
export const specialSituationOptions: { value: SpecialSituation; label: string }[] = [
  { value: "economic_group", label: "Grupo econômico" },
  { value: "multiple_branches", label: "Várias filiais" },
  { value: "icms_st", label: "ICMS-ST relevante" },
  { value: "interstate_volume", label: "Grande volume interestadual" },
  { value: "import_export", label: "Importação / exportação" },
  { value: "marketplace_volume", label: "Marketplace com alto volume" },
  { value: "complex_industry", label: "Indústria complexa" },
  { value: "overdue_accounting", label: "Contabilidade atrasada" },
  { value: "tax_liabilities", label: "Passivo fiscal relevante" },
];

export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function formatBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    amount,
  );
}

/**
 * Retorna o motivo (texto amigável) quando a combinação escolhida exige
 * proposta personalizada, ou `null` quando pode seguir pelo cálculo
 * automático. Data-driven: qualquer modificador `null` na `pricingConfig`
 * bloqueia automaticamente, sem precisar listar as combinações aqui — se a
 * WJB marcar uma nova faixa como "PROPOSTA PERSONALIZADA" no futuro, basta
 * trocar o valor para `null` na config.
 */
function blockReason(state: SimulationState): string | null {
  if (!state.regime) return null;
  const regime = state.regime;

  if (state.specialSituations.length > 0) {
    return "Identificamos uma característica operacional que exige uma análise específica da nossa equipe.";
  }

  if (state.activity && pricingConfig.activityModifiers[regime][state.activity] === null) {
    return "Sua atividade tem uma complexidade que exige uma análise específica.";
  }

  if (state.employees && pricingConfig.employeeModifiers[regime][state.employees] === null) {
    return "A quantidade de empregados informada está fora do padrão de cálculo automático deste plano.";
  }

  if (state.monthlyRevenue) {
    const revenueMap = pricingConfig.revenueModifiers[regime];
    if (revenueMap && revenueMap[state.monthlyRevenue] === null) {
      return "O faturamento informado está acima do padrão de cálculo automático deste plano.";
    }
  }

  if (state.addons.invoiceIssuance && state.addons.invoiceVolume) {
    if (pricingConfig.addons.invoiceIssuance.tiers[state.addons.invoiceVolume] === null) {
      return "O volume de notas fiscais informado está acima do padrão de cálculo automático.";
    }
  }

  return null;
}

/**
 * Calcula a estimativa mensal a partir do estado do simulador, somando:
 * Plano-base + Atividade + Inscrição Estadual + Sócios + Funcionários +
 * Faturamento + Adicionais (Simulador_Teste da planilha oficial). Quando
 * qualquer parte da seleção está marcada como "PROPOSTA PERSONALIZADA" na
 * planilha, retorna `requiresCustomQuote: true` em vez de um valor fechado.
 */
export function calculatePrice(state: SimulationState): PriceEstimate | null {
  if (!state.regime) return null;
  const regime = state.regime;
  const basePrice = pricingConfig.base[regime];

  const reason = blockReason(state);
  if (reason) {
    return {
      mode: PRICING_MODE,
      requiresCustomQuote: true,
      customQuoteReason: reason,
      isFloorOnly: false,
      basePrice,
      amount: null,
    };
  }

  const activityModifier = state.activity
    ? (pricingConfig.activityModifiers[regime][state.activity] ?? 0)
    : 0;
  const stateRegistrationModifier = state.hasStateRegistration
    ? pricingConfig.stateRegistrationModifiers[regime][state.hasStateRegistration]
    : 0;
  const partnersMap = pricingConfig.partnerModifiers[regime];
  const partnersModifier = state.partners && partnersMap ? partnersMap[state.partners] : 0;
  const employeesModifier = state.employees
    ? (pricingConfig.employeeModifiers[regime][state.employees] ?? 0)
    : 0;
  const revenueMap = pricingConfig.revenueModifiers[regime];
  const revenueModifier =
    state.monthlyRevenue && revenueMap ? (revenueMap[state.monthlyRevenue] ?? 0) : 0;
  const invoiceAddon =
    state.addons.invoiceIssuance && state.addons.invoiceVolume
      ? (pricingConfig.addons.invoiceIssuance.tiers[state.addons.invoiceVolume] ?? 0)
      : 0;
  const fiscalMonitorAddon = state.addons.fiscalMonitor
    ? pricingConfig.addons.fiscalMonitor.monthlyPrice
    : 0;

  const amount =
    basePrice +
    activityModifier +
    stateRegistrationModifier +
    partnersModifier +
    employeesModifier +
    revenueModifier +
    invoiceAddon +
    fiscalMonitorAddon;

  return {
    mode: PRICING_MODE,
    requiresCustomQuote: false,
    customQuoteReason: null,
    isFloorOnly: amount === basePrice,
    basePrice,
    amount: Math.round(amount * 100) / 100,
  };
}
