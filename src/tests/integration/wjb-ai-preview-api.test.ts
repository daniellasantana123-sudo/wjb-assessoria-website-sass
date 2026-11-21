import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const getActiveTenantMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getSession: () => getSessionMock(), getVerifiedSession: () => getSessionMock() }));
vi.mock("@/lib/tenant", () => ({
  getActiveTenant: (id: string) => getActiveTenantMock(id),
}));

const { POST } = await import("@/app/api/wjb-ai/fiscal/drafts/preview/route");

function req(body: unknown) {
  return new Request("http://localhost:3000/api/wjb-ai/fiscal/drafts/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const body = {
  serviceDescription: "Serviços de manicure",
  grossAmount: "80.00",
  competence: "2026-11",
  taker: { document: "11.222.333/0001-81", name: "Tomadora Sintética Ltda" },
};

afterEach(() => {
  vi.unstubAllEnvs();
  getSessionMock.mockReset();
  getActiveTenantMock.mockReset();
});

describe("POST /api/wjb-ai/fiscal/drafts/preview", () => {
  it("desligado por padrão: 404 sem nem consultar a sessão", async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(404);
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("ligado: empresa resolvida pela sessão, sem transmissão", async () => {
    vi.stubEnv("WJB_AI_ENABLED", "true");
    getSessionMock.mockResolvedValue({
      userId: "u-1",
      email: "",
      fullName: null,
      isWjbStaff: false,
      staffRole: null,
    });
    getActiveTenantMock.mockResolvedValue({
      id: "tenant-a",
      name: "A",
      cnpj: "",
      role: "owner",
    });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(getActiveTenantMock).toHaveBeenCalledWith("u-1");
    const json = await res.json();
    expect(json.transmitted).toBe(false);
    expect(json.preview.taker.documentMasked).toBe("***0181");
  });
});
