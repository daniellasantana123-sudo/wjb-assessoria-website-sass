import { describe, expect, it, vi } from "vitest";

/**
 * A rota /api/leads agora persiste em `public.leads` (ver
 * 0010_leads_table.sql) via `@/lib/db/supabase/server`. Mockado aqui pra
 * testar validação/roteamento sem depender de um Supabase real — a
 * cobertura de RLS/persistência de verdade é o teste manual de ponta a
 * ponta no navegador (ver docs/architecture/architecture.md).
 */
const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ insert: insertMock }),
  }),
}));

const { POST } = await import("@/app/api/leads/route");

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      expect.objectContaining({ email: "maria@example.com", form_context: "Contato" }),
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
        tracking: { sourcePath: "/", utmSource: null, utmMedium: null, utmCampaign: null },
      }),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "assinante@example.com", form_context: "Newsletter" }),
    );
  });
});
