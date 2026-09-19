export type Regime = "mei" | "simples" | "presumido";

export type Activity = "services" | "commerce" | "mixed" | "industry" | "other";

export type Partners = "1" | "2" | "3" | "4" | "5+";

export type Employees = "0" | "1" | "2" | "3-5" | "6-10" | "11-20" | "20+";

/**
 * "0-30000", "400001-800000" e "800000+" existem apenas para o Lucro
 * Presumido — o Simples Nacional usa faixas próprias (ver
 * `simplesRevenueOptions`/`presumidoRevenueOptions` em `@/config/pricing`).
 * MEI não usa faturamento (Tabela_de_Precos_WJB_Simulador_SP_2026, aba
 * Regras_Preco — não existe linha de Faturamento para o regime "mei").
 */
export type MonthlyRevenue =
  | "0-15000"
  | "0-30000"
  | "15001-30000"
  | "30001-60000"
  | "60001-100000"
  | "100001-200000"
  | "200001-400000"
  | "400000+"
  | "400001-800000"
  | "800000+";

export type InvoiceVolume = "1-10" | "11-30" | "31-60" | "61-100" | "100+";

export type StateRegistration = "yes" | "no" | "unknown";

/**
 * Situações da aba "Excecoes" da planilha oficial que tiram o perfil do
 * cálculo automático, independentemente dos demais campos. "Mais de 20
 * funcionários" não está aqui de propósito — já é coberto pela própria
 * faixa de Funcionários (evita perguntar a mesma coisa duas vezes).
 */
export type SpecialSituation =
  | "economic_group"
  | "multiple_branches"
  | "icms_st"
  | "interstate_volume"
  | "import_export"
  | "marketplace_volume"
  | "complex_industry"
  | "overdue_accounting"
  | "tax_liabilities";

export type PricingMode = "lead-estimate" | "automatic";

export interface SimulationState {
  regime: Regime | null;
  state: string;
  activity: Activity | null;
  hasStateRegistration: StateRegistration | null;
  partners: Partners | null;
  employees: Employees | null;
  monthlyRevenue: MonthlyRevenue | null;
  specialSituations: SpecialSituation[];
  addons: {
    invoiceIssuance: boolean;
    invoiceVolume: InvoiceVolume | null;
    fiscalMonitor: boolean;
  };
}

/**
 * União discriminada por `requiresCustomQuote` — quando true (perfil marcado
 * como "PROPOSTA PERSONALIZADA" na planilha oficial), `amount` é sempre
 * `null` e `customQuoteReason` sempre uma string; o TypeScript já garante
 * isso em quem consome o resultado, sem precisar de asserções (`!`).
 */
export type PriceEstimate =
  | {
      mode: PricingMode;
      requiresCustomQuote: true;
      customQuoteReason: string;
      isFloorOnly: false;
      basePrice: number;
      amount: null;
    }
  | {
      mode: PricingMode;
      requiresCustomQuote: false;
      customQuoteReason: null;
      isFloorOnly: boolean;
      basePrice: number;
      amount: number;
    };
