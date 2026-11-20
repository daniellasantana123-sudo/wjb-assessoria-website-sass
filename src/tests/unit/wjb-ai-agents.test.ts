import { describe, expect, it } from "vitest";

import { AGENTS, TOOLS, ToolNotAllowedError, assertToolAllowed } from "@/lib/wjb-ai/agents/contracts";

describe("contratos dos agentes", () => {
  it("são exatamente os 6 agentes da arquitetura", () => {
    expect(AGENTS.map((a) => a.id)).toEqual(["atendimento", "cadastro", "fiscal", "validacao", "supervisao", "auditoria"]);
  });

  it("nenhuma ferramenta transmite nota nem expõe dado pessoal ao modelo", () => {
    for (const t of Object.values(TOOLS)) {
      expect(["read", "draft", "human_task", "audit"]).toContain(t.effect);
      expect(t.name).not.toMatch(/submit|emit|issue|transmit|enviar/i);
      expect(t.returnsPersonalData).toBe(false);
    }
  });

  it("validação, cadastro, supervisão e auditoria não usam modelo de IA", () => {
    expect(AGENTS.filter((a) => a.usesLlm).map((a) => a.id)).toEqual(["atendimento", "fiscal"]);
  });

  it("agente só usa as próprias ferramentas", () => {
    expect(assertToolAllowed("fiscal", "create_fiscal_draft").effect).toBe("draft");
    expect(() => assertToolAllowed("atendimento", "create_fiscal_draft")).toThrow(ToolNotAllowedError);
    expect(() => assertToolAllowed("fiscal", "submit_authorized_document")).toThrow(ToolNotAllowedError);
    expect(() => assertToolAllowed("desconhecido", "get_request_status")).toThrow(ToolNotAllowedError);
  });
});
