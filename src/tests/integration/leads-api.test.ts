import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A rota /api/leads agora persiste em `public.leads` (ver
 * 0010_leads_table.sql) via `@/lib/db/supabase/server`. Mockado aqui pra
 * testar validação/roteamento sem depender de um Supabase real — a
 * cobertura de RLS/persistência de verdade é o teste manual de ponta a
 * ponta no navegador (ver docs/architecture/architecture.md).
 */
const insertMock = vi.fn().mockResolvedValue({ error: null });
const isSupabaseConfiguredMock = vi.fn().mockReturnValue(true);
vi.mock("@/lib/db/supabase/server", () => ({
  isSupabaseConfigured: () => isSupabaseConfiguredMock(),
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ insert: insertMock }),
  }),
}));

const { POST } = await import("@/app/api/leads/route");

/**
 * Cada request sai de um IP diferente de propósito: o rate limit real
 * (`isRateLimited`, 5 req/min por IP) é compartilhado por todos os testes
 * deste arquivo e passou a estourar 429 quando a suíte cresceu. Variar o
 * IP mantém o limitador de verdade no caminho (sem mock) e ainda testa
 * cada cenário isoladamente.
 */
let requestCount = 0;
function makeRequest(body: unknown) {
  requestCount += 1;
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `203.0.113.${requestCount}`,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  name: "Maria Teste",
  email: "maria@example.com",
  phone: "11999998888",
  company: "",
  cnpj: "",
  serviceInterest: "Contabilidade",
  message: "Quero saber mais sobre os serviços.",
  consent: true,
  formContext: "Contato",
  tracking: {
    sourcePath: "/contato",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
  },
};

describe("POST /api/leads", () => {
  it("aceita um payload válido e grava no banco", async () => {
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "maria@example.com",
        form_context: "Contato",
      }),
    );
  });

  it("rejeita um payload inválido com detalhe dos campos", async () => {
    const response = await POST(makeRequest({ name: "a" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.issues).toHaveProperty("name");
    expect(json.issues).toHaveProperty("email");
  });

  it("rejeita JSON malformado", async () => {
    const request = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ isto nao e json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("aceita uma inscrição de newsletter (schema menor, sem telefone/assunto/consentimento)", async () => {
    const response = await POST(
      makeRequest({
        name: "Newsletter",
        email: "assinante@example.com",
        message: "Inscrição na newsletter.",
        formContext: "Newsletter",
        tracking: {
          sourcePath: "/",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
        },
      }),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "assinante@example.com",
        form_context: "Newsletter",
      }),
    );
  });

  /**
   * Bug real de produção (2026-09-23): sem as env vars do Supabase, a rota
   * chamava `createClient()` direto, que lança, e todo formulário do site
   * (incluindo o Assistente Virtual) morria com 500 antes até de validar.
   * Agora tem que degradar pra 503 com `code` legível - o cliente usa isso
   * pra oferecer o WhatsApp em vez de "tente novamente em instantes".
   */
  describe("sem Supabase configurado", () => {
    beforeEach(() => {
      isSupabaseConfiguredMock.mockReturnValue(false);
      insertMock.mockClear();
    });
    afterEach(() => {
      isSupabaseConfiguredMock.mockReturnValue(true);
    });

    it("não quebra: responde 503 com code em vez de estourar 500", async () => {
      const response = await POST(makeRequest(validPayload));
      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.code).toBe("storage_unavailable");
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("ainda valida o payload antes de tudo (400 continua sendo 400)", async () => {
      const response = await POST(makeRequest({ name: "a" }));
      expect(response.status).toBe(400);
    });
  });

  it("responde 503 quando o insert falha, sem derrubar a rota", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.code).toBe("storage_unavailable");
  });
});
