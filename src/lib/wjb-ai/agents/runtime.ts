import { z } from "zod";

import type { Session } from "@/lib/auth/dal";
import type { MyOrganization } from "@/lib/tenant";
import {
  assertToolAllowed,
  ToolNotAllowedError,
  type ToolName,
} from "@/lib/wjb-ai/agents/contracts";
import {
  detectDocument,
  normalizeDocument,
} from "@/lib/wjb-ai/fiscal/documents";
import { parseNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import {
  evaluatePolicy,
  type ApprovedFiscalProfile,
  type AuthorizationGrant,
  type PolicyResult,
} from "@/lib/wjb-ai/fiscal/policy";

/**
 * Execução dos agentes do WJB AI (Fase 4, preparação). Sem modelo de IA:
 * `LlmProvider` existe só como contrato e o padrão é `DisabledLlmProvider`.
 * A interpretação usa regras fixas; a VALIDAÇÃO fiscal é sempre o motor
 * determinístico (parseNfseDraft + evaluatePolicy) e não pode ser trocada.
 *
 * Toda chamada de ferramenta passa por `runTool`: agente autorizado
 * (contracts.ts), entrada validada por schema estrito (empresa NUNCA vem do
 * agente), execução e registro auditável sem dado pessoal.
 */

export interface AgentContext {
  session: Session;
  tenant: MyOrganization; // resolvida no servidor
  traceId: string;
  loadFiscalProfile: (
    tenantId: string,
  ) => Promise<ApprovedFiscalProfile | null>;
  loadAuthorizationGrant: (
    tenantId: string,
  ) => Promise<AuthorizationGrant | null>;
  today: string;
}

export interface AgentAuditEntry {
  traceId: string;
  agentId: string;
  tool: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}

export interface AgentAuditSink {
  record(entry: AgentAuditEntry): Promise<void>;
}

export class InMemoryAgentAuditSink implements AgentAuditSink {
  entries: AgentAuditEntry[] = [];
  async record(entry: AgentAuditEntry) {
    this.entries.push(entry);
  }
}

/** Contrato para um provedor de IA futuro (só depois de LGPD e contrato). */
export interface LlmProvider {
  readonly name: string;
  extractJson(instructions: string, untrustedText: string): Promise<unknown>;
}
export class LlmNotConfiguredError extends Error {}
export class DisabledLlmProvider implements LlmProvider {
  readonly name = "desligado";
  async extractJson(): Promise<unknown> {
    throw new LlmNotConfiguredError(
      "Nenhum provedor de IA contratado/aprovado (LGPD pendente).",
    );
  }
}

/** Entradas das ferramentas: estritas, sem campo de empresa. */
export const TOOL_INPUTS = {
  get_authenticated_client_context: z.object({}).strict(),
  get_approved_fiscal_profile: z.object({}).strict(),
  get_request_status: z.object({ requestId: z.string().uuid() }).strict(),
  extract_invoice_intent: z
    .object({ text: z.string().min(1).max(4000) })
    .strict(),
  list_required_fields: z.object({ draft: z.unknown() }).strict(),
  validate_draft: z.object({ draft: z.unknown() }).strict(),
  create_fiscal_draft: z
    .object({ draft: z.unknown(), confirmedByClient: z.literal(true) })
    .strict(),
  create_human_review_task: z
    .object({ reason: z.string().min(3).max(500) })
    .strict(),
  record_agent_event: z.object({ event: z.string().min(1).max(100) }).strict(),
} satisfies Record<ToolName, z.ZodType>;

export type ToolHandler = (
  ctx: AgentContext,
  input: unknown,
) => Promise<unknown>;

export async function runTool(
  agentId: string,
  tool: string,
  rawInput: unknown,
  ctx: AgentContext,
  handlers: Partial<Record<ToolName, ToolHandler>>,
  sink: AgentAuditSink,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const started = Date.now();
  const finish = async (ok: boolean, error?: string) =>
    sink.record({
      traceId: ctx.traceId,
      agentId,
      tool,
      ok,
      error,
      durationMs: Date.now() - started,
    });
  try {
    assertToolAllowed(agentId, tool);
    const parsed = TOOL_INPUTS[tool as ToolName].safeParse(rawInput);
    if (!parsed.success) {
      await finish(false, "entrada_invalida");
      return { ok: false, error: "Entrada da ferramenta inválida." };
    }
    const handler = handlers[tool as ToolName];
    if (!handler) {
      await finish(false, "ferramenta_sem_implementacao");
      return { ok: false, error: "Ferramenta não implementada nesta fase." };
    }
    const output = await handler(ctx, parsed.data);
    await finish(true);
    return { ok: true, output };
  } catch (error) {
    const code =
      error instanceof ToolNotAllowedError
        ? "ferramenta_nao_autorizada"
        : "erro_interno";
    await finish(false, code);
    return {
      ok: false,
      error:
        code === "ferramenta_nao_autorizada"
          ? "Ferramenta não autorizada para este agente."
          : "Falha interna.",
    };
  }
}

/**
 * Extração por REGRAS (sem IA) de um pedido escrito pelo cliente. Só
 * reconhece o que está explícito; o que faltar vira pergunta.
 */
export function ruleBasedExtract(text: string) {
  const amount = text.match(/R\$\s*([\d.]{1,12},\d{2}|\d{1,9}(?:\.\d{2})?)/);
  const doc = text.match(
    /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/,
  );
  const competence = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  const takerName = text.match(
    /(?:para|tomador[:]?)\s+([A-ZÀ-Ú][\p{L}]+(?:\s+[A-ZÀ-Ú][\p{L}]+){1,4})/u,
  );
  const service = text.match(
    /servi[cç]o(?:s)?(?: de| prestado:?)?\s+([^,.;]{3,120})/i,
  );
  const document = doc ? normalizeDocument(doc[1]) : undefined;
  return {
    source: "regras" as const,
    draft: {
      serviceDescription: service?.[1]?.trim() ?? "",
      grossAmount: amount
        ? amount[1].includes(",")
          ? amount[1].replace(/\./g, "").replace(",", ".")
          : amount[1]
        : "",
      competence: competence ? `${competence[1]}-${competence[2]}` : "",
      // Para nas palavras CPF/CNPJ, que não fazem parte do nome.
      taker: {
        document: document ?? "",
        name: (takerName?.[1] ?? "").replace(/\s+(CPF|CNPJ)\b.*$/u, "").trim(),
      },
    },
    documentLooksValid: document ? detectDocument(document) !== null : false,
  };
}

export type IntakeOutcome =
  | { kind: "faq_or_human"; reason: string }
  | { kind: "missing_fields"; missing: { field: string; message: string }[] }
  | { kind: "ready_for_client_confirmation"; policy: PolicyResult };

/** Pipeline Atendimento -> Cadastro -> Fiscal -> Validação -> Supervisão, auditado. Nunca grava nem transmite. */
export async function runIntakePipeline(
  text: string,
  ctx: AgentContext,
  sink: AgentAuditSink,
): Promise<IntakeOutcome> {
  const isInvoiceRequest = /\b(nota|nfs-?e|nota fiscal)\b/i.test(text);
  await runTool(
    "auditoria",
    "record_agent_event",
    { event: isInvoiceRequest ? "intencao_nfse" : "intencao_outra" },
    ctx,
    { record_agent_event: async () => ({}) },
    sink,
  );
  if (!isInvoiceRequest) {
    await runTool(
      "supervisao",
      "create_human_review_task",
      { reason: "Pedido fora do fluxo de NFS-e." },
      ctx,
      { create_human_review_task: async () => ({ queued: true }) },
      sink,
    );
    return { kind: "faq_or_human", reason: "Encaminhado à equipe." };
  }
  await runTool(
    "cadastro",
    "get_authenticated_client_context",
    {},
    ctx,
    {
      get_authenticated_client_context: async (c) => ({
        tenantId: c.tenant.id,
        role: c.tenant.role,
      }),
    },
    sink,
  );
  const extracted = await runTool(
    "fiscal",
    "extract_invoice_intent",
    { text },
    ctx,
    {
      extract_invoice_intent: async (_c, i) =>
        ruleBasedExtract((i as { text: string }).text),
    },
    sink,
  );
  const draft = extracted.ok
    ? (extracted.output as ReturnType<typeof ruleBasedExtract>).draft
    : {};
  const validated = await runTool(
    "validacao",
    "validate_draft",
    { draft },
    ctx,
    {
      validate_draft: async (c, i) => {
        const parsed = parseNfseDraft((i as { draft: unknown }).draft);
        if (!parsed.ok) return { ok: false, missing: parsed.missingOrInvalid };
        const [profile, grant] = await Promise.all([
          c.loadFiscalProfile(c.tenant.id),
          c.loadAuthorizationGrant(c.tenant.id),
        ]);
        return {
          ok: true,
          policy: evaluatePolicy({
            moduleEnabled: true,
            draft: parsed.draft,
            fiscalProfile: profile,
            authorizationGrant: grant,
            duplicateSuspected: false,
            today: c.today,
          }),
        };
      },
    },
    sink,
  );
  const v = validated.ok
    ? (validated.output as {
        ok: boolean;
        missing?: { field: string; message: string }[];
        policy?: PolicyResult;
      })
    : { ok: false, missing: [] };
  if (!v.ok) return { kind: "missing_fields", missing: v.missing ?? [] };
  if (v.policy!.decision !== "READY_FOR_CONFIRMATION") {
    await runTool(
      "supervisao",
      "create_human_review_task",
      {
        reason: `Política: ${v.policy!.reasons.join(", ") || v.policy!.decision}`,
      },
      ctx,
      { create_human_review_task: async () => ({ queued: true }) },
      sink,
    );
  }
  return { kind: "ready_for_client_confirmation", policy: v.policy! };
}
