import { normalizeDocument } from "@/lib/wjb-ai/fiscal/documents";

/** CPF/CNPJ mascarado para telas e prévias: só os dígitos do meio. */
export function maskDocument(raw: string): string {
  const d = normalizeDocument(raw);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
  return "***";
}
