import { z } from "zod";

import {
  detectDocument,
  normalizeDocument,
} from "@/lib/wjb-ai/fiscal/documents";

/**
 * Rascunho de NFS-e enviado pelo cliente (F1). Só os dados que o cliente
 * conhece. Código de serviço, alíquota, retenções, NBS, cClassTrib e grupos
 * IBS/CBS NÃO entram aqui: vêm do perfil fiscal aprovado pelo contador, nunca
 * do cliente nem de um LLM (seção 2.4 do documento mestre).
 *
 * `.strict()`: qualquer campo a mais é recusado - em especial `tenant_id`,
 * que só sai da sessão.
 */
const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

export const nfseDraftSchema = z
  .object({
    serviceDescription: z
      .string()
      .trim()
      .min(5, "Descreva o serviço prestado.")
      .max(2000),
    grossAmount: z
      .string()
      .trim()
      .regex(AMOUNT, "Informe o valor com ponto decimal, por exemplo 250.00."),
    competence: z
      .string()
      .regex(
        /^\d{4}-(0[1-9]|1[0-2])$/,
        "Informe a competência no formato AAAA-MM.",
      ),
    taker: z
      .object({
        document: z.string().trim().min(11).max(18),
        name: z.string().trim().min(2).max(200),
        email: z.string().trim().email().optional(),
      })
      .strict(),
    sourceReference: z.string().trim().max(100).optional(),
  })
  .strict();

export type NfseDraftInput = z.infer<typeof nfseDraftSchema>;

export interface NormalizedNfseDraft {
  serviceDescription: string;
  amountCents: number;
  competence: string;
  taker: {
    document: string;
    documentKind: "CPF" | "CNPJ";
    name: string;
    email?: string;
  };
  sourceReference?: string;
}

export type DraftParseResult =
  | { ok: true; draft: NormalizedNfseDraft }
  | { ok: false; missingOrInvalid: { field: string; message: string }[] };

export function toCents(amount: string): number {
  const [int, frac = ""] = amount.split(".");
  return Number(int) * 100 + Number(frac.padEnd(2, "0"));
}

export function parseNfseDraft(body: unknown): DraftParseResult {
  const parsed = nfseDraftSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      missingOrInvalid: parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(corpo)",
        message: issue.message,
      })),
    };
  }
  const data = parsed.data;
  const documentKind = detectDocument(data.taker.document);
  const errors: { field: string; message: string }[] = [];
  if (!documentKind)
    errors.push({
      field: "taker.document",
      message: "CPF ou CNPJ do tomador inválido.",
    });
  const amountCents = toCents(data.grossAmount);
  if (amountCents <= 0)
    errors.push({
      field: "grossAmount",
      message: "O valor precisa ser maior que zero.",
    });
  if (errors.length || !documentKind)
    return { ok: false, missingOrInvalid: errors };

  return {
    ok: true,
    draft: {
      serviceDescription: data.serviceDescription,
      amountCents,
      competence: data.competence,
      taker: {
        document: normalizeDocument(data.taker.document),
        documentKind,
        name: data.taker.name,
        ...(data.taker.email ? { email: data.taker.email } : {}),
      },
      ...(data.sourceReference
        ? { sourceReference: data.sourceReference }
        : {}),
    },
  };
}
