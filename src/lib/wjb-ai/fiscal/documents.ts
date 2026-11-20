/**
 * Validação de dígitos verificadores de CPF e CNPJ. Não decide nada fiscal:
 * só evita aceitar um documento digitado errado.
 *
 * CNPJ alfanumérico: a Receita passou a admitir letras nas 12 primeiras
 * posições, com o mesmo cálculo usando o valor (código ASCII - 48) de cada
 * caractere; os 2 dígitos verificadores continuam numéricos. Pendente de
 * conferência com o documento oficial (docs/wjb-ai/06-VALIDACAO-FISCAL-OFICIAL.md).
 */

export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function allSame(value: string): boolean {
  return /^(.)\1+$/.test(value);
}

export function isValidCpf(raw: string): boolean {
  const cpf = normalizeDocument(raw);
  if (!/^\d{11}$/.test(cpf) || allSame(cpf)) return false;
  const digits = cpf.split("").map(Number);
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== digits[length]) return false;
  }
  return true;
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeDocument(raw);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || allSame(cnpj)) return false;
  const values = cnpj.split("").map((c) => c.charCodeAt(0) - 48);
  const weights = (length: number) =>
    Array.from({ length }, (_, i) => {
      const w = length - i + 1;
      return w > 9 ? w - 8 : w;
    });
  for (const length of [12, 13]) {
    const w = weights(length);
    const sum = w.reduce((acc, weight, i) => acc + values[i] * weight, 0);
    const rest = sum % 11;
    const dv = rest < 2 ? 0 : 11 - rest;
    if (dv !== values[length]) return false;
  }
  return true;
}

export type DocumentKind = "CPF" | "CNPJ";

export function detectDocument(raw: string): DocumentKind | null {
  const doc = normalizeDocument(raw);
  if (doc.length === 11 && isValidCpf(doc)) return "CPF";
  if (doc.length === 14 && isValidCnpj(doc)) return "CNPJ";
  return null;
}
