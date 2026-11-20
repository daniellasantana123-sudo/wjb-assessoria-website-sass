/**
 * Registro versionado dos contratos fiscais da DPS (Fase 5).
 *
 * Os dois pacotes oficiais em uso hoje declaram o MESMO `versao="1.01"`, mas
 * têm esquemas diferentes (produção x produção restrita com a NT 009). Por
 * isso o leiaute é escolhido por AMBIENTE e DATA DE VIGÊNCIA, nunca pelo
 * atributo `versao`. Uma vigência futura nunca é aplicada antes da data;
 * vigência não publicada oficialmente fica `null` (= não vale).
 *
 * Fontes: docs/wjb-ai/oficial/xsd/FONTE.md e docs/wjb-ai/25-FASE-5-*.md.
 */
export type NationalEnvironment = "producao_restrita" | "producao";

export interface LayoutContract {
  id: string;
  /** Valor do atributo `versao` da DPS. */
  dpsVersion: "1.00" | "1.01";
  namespace: string;
  /** Pasta com os XSD oficiais, a partir da raiz do repositório. */
  xsdDir: string;
  /** Início de vigência por ambiente (AAAA-MM-DD). `null` = sem data oficial. */
  validFrom: Record<NationalEnvironment, string | null>;
  /** Regras que mudam entre pacotes e o conector precisa respeitar. */
  rules: {
    /** CNPJ alfanumérico aceito no XML e no id da DPS. */
    alphanumericCnpj: boolean;
    /** Faixa de série aceita pelo esquema (o canal API ainda exige 1-49999). */
    seriesMax: number;
    /** Grupo de dedução/redução da base do ISSQN. */
    deductionGroup: "vDedRed" | "vAjusteBC";
    /** Onde fica `finNFSe`. */
    finNFSeLocation: "IBSCBS" | "infDPS";
  };
  source: string;
}

export const NFSE_NAMESPACE = "http://www.sped.fazenda.gov.br/nfse";

export const LAYOUT_CONTRACTS: readonly LayoutContract[] = [
  {
    id: "producao-v1.01-20260209",
    dpsVersion: "1.01",
    namespace: NFSE_NAMESPACE,
    xsdDir: "docs/wjb-ai/oficial/xsd/producao-v1.01-20260209",
    // Em vigor nos dois ambientes antes da NT 009. Data de início anterior ao
    // uso pela WJB; a data do pacote é suficiente para o registro.
    validFrom: { producao: "2026-02-09", producao_restrita: "2026-02-09" },
    rules: {
      alphanumericCnpj: false,
      seriesMax: 99999,
      deductionGroup: "vDedRed",
      finNFSeLocation: "IBSCBS",
    },
    source:
      "nfse-esquemas_xsd-v1-01-20260209.zip (NT 004 v2.0 + NT 007), gov.br/nfse",
  },
  {
    id: "producao-restrita-nt009-r1-20261020",
    dpsVersion: "1.01",
    namespace: NFSE_NAMESPACE,
    xsdDir: "docs/wjb-ai/oficial/xsd/producao-restrita-nt009-r1-20261020",
    // Produção restrita desde 20/10/2026 (notícia CGNFS-e). Em produção, a
    // previsão é 01/12/2026, mas o cronograma formal ainda não foi publicado:
    // fica null até a publicação oficial.
    validFrom: { producao_restrita: "2026-10-20", producao: null },
    rules: {
      alphanumericCnpj: true,
      seriesMax: 89999,
      deductionGroup: "vAjusteBC",
      finNFSeLocation: "infDPS",
    },
    source:
      "esquemas_prod_restrita_20261020.zip (NT 009 release 1), gov.br/nfse",
  },
];

export class LayoutNotAvailableError extends Error {
  constructor(environment: NationalEnvironment, date: string) {
    super(`Nenhum leiaute vigente para ${environment} em ${date}.`);
    this.name = "LayoutNotAvailableError";
  }
}

/**
 * Leiaute vigente num ambiente e data: o de início mais recente que já
 * começou. Vigência futura ou não publicada nunca é escolhida.
 */
export function resolveLayout(
  environment: NationalEnvironment,
  date: string,
  contracts: readonly LayoutContract[] = LAYOUT_CONTRACTS,
): LayoutContract {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const active = contracts
    .filter((c) => {
      const from = c.validFrom[environment];
      return from !== null && from <= date;
    })
    .sort((a, b) =>
      a.validFrom[environment]! < b.validFrom[environment]! ? 1 : -1,
    );
  if (!active.length) throw new LayoutNotAvailableError(environment, date);
  return active[0];
}

/** Faixa de série do canal API (FAQ NFS-e v1.4, 18.1: 00001-49999; E0010 fora dela). */
export const API_SERIES_RANGE = { min: 1, max: 49999 } as const;

export function isApiSeries(series: number, layout: LayoutContract): boolean {
  return (
    Number.isInteger(series) &&
    series >= API_SERIES_RANGE.min &&
    series <= Math.min(API_SERIES_RANGE.max, layout.rules.seriesMax)
  );
}
