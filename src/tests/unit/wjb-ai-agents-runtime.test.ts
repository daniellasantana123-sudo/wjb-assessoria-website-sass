import { describe, expect, it } from "vitest";

import {
  DisabledLlmProvider,
  InMemoryAgentAuditSink,
  LlmNotConfiguredError,
  ruleBasedExtract,
  runIntakePipeline,
  runTool,
  type AgentContext,
} from "@/lib/wjb-ai/agents/runtime";

// Dados fictícios.
const ctx: AgentContext = {
  session: {
    userId: "u-a",
    email: "",
    fullName: null,
    isWjbStaff: false,
    staffRole: null,
  },
  tenant: { id: "tenant-a", name: "A", cnpj: "", role: "owner" },
  traceId: "trace-1",
  loadFiscalProfile: async () => null,
  loadAuthorizationGrant: async () => null,
  today: "2026-11-20",
};
const pedido =
  "Preciso de uma nota fiscal de R$ 1.250,00 para Maria Fictícia CPF 529.982.247-25, serviço de corte e escova, competência 2026-11";

describe("execução de ferramentas dos agentes", () => {
  it("agente só usa as próprias ferramentas e a falha fica auditada", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runTool(
      "atendimento",
      "create_fiscal_draft",
      { draft: {}, confirmedByClient: true },
      ctx,
      {},
      sink,
    );
    expect(r.ok).toBe(false);
    expect(sink.entries[0]).toMatchObject({
      agentId: "atendimento",
      tool: "create_fiscal_draft",
      ok: false,
      error: "ferramenta_nao_autorizada",
    });
  });

  it("entrada com empresa vinda do agente é recusada", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runTool(
      "cadastro",
      "get_authenticated_client_context",
      { tenant_id: "tenant-b" },
      ctx,
      { get_authenticated_client_context: async () => ({}) },
      sink,
    );
    expect(r.ok).toBe(false);
    expect(sink.entries[0].error).toBe("entrada_invalida");
  });

  it("criar rascunho exige confirmação explícita do cliente", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runTool(
      "fiscal",
      "create_fiscal_draft",
      { draft: {} },
      ctx,
      { create_fiscal_draft: async () => ({}) },
      sink,
    );
    expect(r.ok).toBe(false);
  });

  it("provedor de IA está desligado", async () => {
    await expect(
      new DisabledLlmProvider().extractJson(),
    ).rejects.toBeInstanceOf(LlmNotConfiguredError);
  });
});

describe("extração por regras", () => {
  it("lê valor, documento, competência e tomador explícitos", () => {
    const e = ruleBasedExtract(pedido);
    expect(e.draft).toMatchObject({
      grossAmount: "1250.00",
      competence: "2026-11",
      taker: { document: "52998224725", name: "Maria Fictícia" },
    });
    expect(e.documentLooksValid).toBe(true);
  });
});

describe("pipeline de atendimento", () => {
  it("pedido completo vai para confirmação do cliente; política decide, não a IA", async () => {
    const sink = new InMemoryAgentAuditSink();
    const out = await runIntakePipeline(pedido, ctx, sink);
    expect(out).toMatchObject({
      kind: "ready_for_client_confirmation",
      policy: { decision: "HUMAN_REVIEW" },
    });
    expect(sink.entries.map((e) => `${e.agentId}:${e.tool}`)).toEqual([
      "auditoria:record_agent_event",
      "cadastro:get_authenticated_client_context",
      "fiscal:extract_invoice_intent",
      "validacao:validate_draft",
      "supervisao:create_human_review_task",
    ]);
  });

  it("pedido incompleto pergunta o que falta, sem inventar", async () => {
    const out = await runIntakePipeline(
      "Quero uma nota fiscal de R$ 80,00",
      ctx,
      new InMemoryAgentAuditSink(),
    );
    expect(out.kind).toBe("missing_fields");
  });

  it("assunto fora de NFS-e vai para a equipe", async () => {
    const out = await runIntakePipeline(
      "Qual o prazo do DAS?",
      ctx,
      new InMemoryAgentAuditSink(),
    );
    expect(out.kind).toBe("faq_or_human");
  });

  it("o registro de auditoria não contém dado pessoal", async () => {
    const sink = new InMemoryAgentAuditSink();
    await runIntakePipeline(pedido, ctx, sink);
    const log = JSON.stringify(sink.entries);
    expect(log).not.toMatch(/52998224725|529\.982|Maria|1\.250|1250/);
  });
});
