import { normalizeDocument } from "@/lib/wjb-ai/fiscal/documents";

/**
 * Identificador da DPS conforme o Anexo I v1.01 (leiaute DPS/NFS-e,
 * documentação atual do gov.br/nfse, consultada em 20/11/2026), regra 139 /
 * rejeição E0004:
 *   "DPS" + Cód.Mun.Emi. (7) + Tipo de Inscrição Federal (1) +
 *   Inscrição Federal (14; CPF completado com zeros à esquerda) +
 *   Série DPS (5) + Núm. DPS (15)  => 45 caracteres.
 * Tipo de inscrição: 1 = CPF, 2 = CNPJ.
 *
 * O Anexo descreve as 42 posições como numéricas; com o CNPJ alfanumérico
 * (vigente desde 08/2026) isso precisa ser conferido no XSD/swagger antes da
 * homologação oficial - por isso CNPJ com letras é recusado aqui por enquanto.
 */
export interface DpsIdParts {
  municipalityIbge: string;
  documentKind: "CPF" | "CNPJ";
  document: string;
  series: number;
  number: number;
}

export class InvalidDpsIdError extends Error {}

export function buildDpsId(p: DpsIdParts): string {
  if (!/^\d{7}$/.test(p.municipalityIbge))
    throw new InvalidDpsIdError(
      "Código IBGE do município emissor deve ter 7 dígitos.",
    );
  const doc = normalizeDocument(p.document);
  if (p.documentKind === "CPF" && !/^\d{11}$/.test(doc))
    throw new InvalidDpsIdError("CPF do emitente inválido.");
  if (p.documentKind === "CNPJ" && !/^\d{14}$/.test(doc)) {
    throw new InvalidDpsIdError(
      "CNPJ do emitente precisa ser numérico até a regra do CNPJ alfanumérico ser confirmada no XSD.",
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
export function dpsIdMatches(id: string, p: DpsIdParts): boolean {
  try {
    return buildDpsId(p) === id;
  } catch {
    return false;
  }
}
