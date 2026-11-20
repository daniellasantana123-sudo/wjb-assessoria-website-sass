import { normalizeDocument } from "@/lib/wjb-ai/fiscal/documents";
import type { LayoutContract } from "@/lib/wjb-ai/fiscal/national/layouts";

/**
 * Identificador da DPS conforme o Anexo I v1.01 (leiaute DPS/NFS-e,
 * documentação atual do gov.br/nfse, consultada em 20/11/2026), regra 139 /
 * rejeição E0004:
 *   "DPS" + Cód.Mun.Emi. (7) + Tipo de Inscrição Federal (1) +
 *   Inscrição Federal (14; CPF completado com zeros à esquerda) +
 *   Série DPS (5) + Núm. DPS (15)  => 45 caracteres.
 * Tipo de inscrição: 1 = CPF, 2 = CNPJ.
 *
 * CNPJ alfanumérico (Fase 5, conferido nos XSD oficiais): o esquema de
 * PRODUÇÃO (v1.01, 09/02/2026) só aceita `DPS[0-9]{42}`; o de PRODUÇÃO
 * RESTRITA com a NT 009 aceita `DPS[0-9]{7}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{20}`.
 * Por isso a letra no CNPJ só passa quando o leiaute vigente permite.
 */

export interface DpsIdParts {
  municipalityIbge: string;
  documentKind: "CPF" | "CNPJ";
  document: string;
  series: number;
  number: number;
}

export class InvalidDpsIdError extends Error {}

export function buildDpsId(
  p: DpsIdParts,
  layout?: Pick<LayoutContract, "rules">,
): string {
  if (!/^\d{7}$/.test(p.municipalityIbge))
    throw new InvalidDpsIdError(
      "Código IBGE do município emissor deve ter 7 dígitos.",
    );
  const alnum = layout?.rules.alphanumericCnpj === true;
  const doc =
    p.documentKind === "CNPJ" && alnum
      ? p.document.toUpperCase().replace(/[^0-9A-Z]/g, "")
      : normalizeDocument(p.document);
  if (p.documentKind === "CPF" && !/^\d{11}$/.test(doc))
    throw new InvalidDpsIdError("CPF do emitente inválido.");
  if (p.documentKind === "CNPJ" && alnum && !/^[0-9A-Z]{12}\d{2}$/.test(doc))
    throw new InvalidDpsIdError("CNPJ do emitente inválido.");
  if (p.documentKind === "CNPJ" && !alnum && !/^\d{14}$/.test(doc)) {
    throw new InvalidDpsIdError(
      "CNPJ alfanumérico não é aceito pelo leiaute vigente neste ambiente.",
    );
  }
  if (!Number.isInteger(p.series) || p.series < 1 || p.series > 99999)
    throw new InvalidDpsIdError("Série da DPS fora de 1-99999.");
  if (
    !Number.isInteger(p.number) ||
    p.number < 1 ||
    p.number > 999_999_999_999_999
  )
    throw new InvalidDpsIdError("Número da DPS fora do intervalo.");
  const id =
    "DPS" +
    p.municipalityIbge +
    (p.documentKind === "CPF" ? "1" : "2") +
    doc.padStart(14, "0") +
    String(p.series).padStart(5, "0") +
    String(p.number).padStart(15, "0");
  if (id.length !== 45)
    throw new InvalidDpsIdError(
      "Identificador da DPS com tamanho diferente de 45.",
    );
  return id;
}

/** Confere se um identificador corresponde às partes (espelho da regra E0004). */
export function dpsIdMatches(
  id: string,
  p: DpsIdParts,
  layout?: Pick<LayoutContract, "rules">,
): boolean {
  try {
    return buildDpsId(p, layout) === id;
  } catch {
    return false;
  }
}
