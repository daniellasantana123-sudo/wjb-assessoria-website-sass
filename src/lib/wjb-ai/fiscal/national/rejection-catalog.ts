import producao from "@/lib/wjb-ai/fiscal/national/rejeicoes-producao-v1.01-20260209.json";
import restrita from "@/lib/wjb-ai/fiscal/national/rejeicoes-producao-restrita-v1.01-20261020.json";
import restritaR2 from "@/lib/wjb-ai/fiscal/national/rejeicoes-producao-restrita-v1.01-20261124.json";

/**
 * Catálogo OFICIAL de rejeições (código -> mensagem), extraído do Anexo I de
 * cada pacote por `scripts/wjb-ai/oficial/extrair-rejeicoes.py`. Nenhuma
 * mensagem é escrita à mão: código fora do catálogo é dito como tal.
 *
 * A categoria é classificação INTERNA da WJB, para encaminhar o problema a
 * quem resolve; não é texto oficial.
 */
type Catalog = {
  source: string;
  codes: Record<string, { message: string; effect: string }>;
};

const CATALOGS: Record<string, Catalog> = {
  "producao-v1.01-20260209": producao as Catalog,
  "producao-restrita-nt009-r1-20261020": restrita as Catalog,
  "producao-restrita-nt009-r2-20261124": restritaR2 as Catalog,
};

export type RejectionCategory =
  | "duplicidade" // a nota já existe: conciliar, nunca reenviar com outro número
  | "certificado" // certificado de transmissão ou de assinatura
  | "autorizacao" // assinatura não é do emitente nem de procurador
  | "estrutura" // XML, compactação, esquema, assinatura malformada
  | "cadastro_fiscal" // regras tributárias: o contador precisa ajustar o perfil
  | "outros";

export interface RejectionExplanation {
  code: string;
  official: boolean;
  message: string;
  effect: string | null;
  category: RejectionCategory;
  source: string | null;
}

export function categorize(code: string): RejectionCategory {
  if (code === "E0014") return "duplicidade";
  if (code === "E0718") return "autorizacao";
  if (/^E12(0\d|1\d)$/.test(code) || code === "E0715" || code === "E0716")
    return "certificado";
  if (
    /^E12[2-4]\d$/.test(code) ||
    code === "E0714" ||
    code === "E0717" ||
    code === "E0004"
  )
    return "estrutura";
  if (/^E0[1-9]\d\d$/.test(code)) return "cadastro_fiscal";
  return "outros";
}

export function explainRejection(
  code: string,
  layoutId: string,
): RejectionExplanation {
  const catalog = CATALOGS[layoutId];
  const entry = catalog?.codes[code];
  return entry
    ? {
        code,
        official: true,
        message: entry.message,
        effect: entry.effect || null,
        category: categorize(code),
        source: catalog.source,
      }
    : {
        code,
        official: false,
        message: "Código não consta no catálogo oficial deste leiaute.",
        effect: null,
        category: categorize(code),
        source: catalog?.source ?? null,
      };
}

export function catalogSize(layoutId: string): number {
  return Object.keys(CATALOGS[layoutId]?.codes ?? {}).length;
}
