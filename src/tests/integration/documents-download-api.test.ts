import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const getTenantRoleMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  getSession: getSessionMock,
  getTenantRole: getTenantRoleMock,
}));

const documentMaybeSingleMock = vi.fn();
const createSignedUrlMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => {
  if (table === "documents") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: documentMaybeSingleMock })),
      })),
    };
  }
  if (table === "audit_log") {
    return { insert: auditInsertMock };
  }
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: fromMock,
    storage: { from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
  }),
}));

const { GET: downloadDocument } = await import("@/app/api/documents/[id]/download/route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrlMock.mockResolvedValue({
    data: { signedUrl: "https://storage.example.com/signed" },
    error: null,
  });
});

describe("GET /api/documents/[id]/download", () => {
  it("responde 401 sem sessão", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await downloadDocument(new Request("http://x"), makeParams("doc-1"));
    expect(response.status).toBe(401);
  });

  it("responde 404 quando a RLS não retorna o documento (empresa diferente)", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", isWjbStaff: false });
    documentMaybeSingleMock.mockResolvedValue({ data: null });

    const response = await downloadDocument(new Request("http://x"), makeParams("doc-de-outra-empresa"));
    expect(response.status).toBe(404);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it("gera URL assinada, audita o download e redireciona", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", isWjbStaff: false });
    getTenantRoleMock.mockResolvedValue("member");
    documentMaybeSingleMock.mockResolvedValue({
      data: { tenant_id: "tenant-1", storage_path: "tenant-1/123-arquivo.pdf", file_name: "arquivo.pdf" },
    });

    const response = await downloadDocument(new Request("http://x"), makeParams("doc-1"));

    expect(createSignedUrlMock).toHaveBeenCalledWith("tenant-1/123-arquivo.pdf", 60);
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.downloaded",
        tenant_id: "tenant-1",
        entity_id: "doc-1",
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example.com/signed");
  });

  it("staff não precisa de getTenantRole (bypassa a checagem de tenant)", async () => {
    getSessionMock.mockResolvedValue({ userId: "staff-1", isWjbStaff: true, staffRole: "contador" });
    documentMaybeSingleMock.mockResolvedValue({
      data: { tenant_id: "tenant-1", storage_path: "tenant-1/123-arquivo.pdf", file_name: "arquivo.pdf" },
    });

    const response = await downloadDocument(new Request("http://x"), makeParams("doc-1"));

    expect(getTenantRoleMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
  });
});
