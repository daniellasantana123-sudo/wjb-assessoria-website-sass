import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  getSession: getSessionMock,
}));

const getMyOrganizationsMock = vi.fn();
vi.mock("@/lib/tenant", () => ({
  getMyOrganizations: getMyOrganizationsMock,
}));

const { GET: getMyOrganizations } = await import("@/app/api/me/organizations/route");

beforeEach(() => {
  getSessionMock.mockReset();
  getMyOrganizationsMock.mockReset();
});

describe("GET /api/me/organizations", () => {
  it("responde 401 sem sessão", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await getMyOrganizations();
    expect(response.status).toBe(401);
  });

  it("staff recebe lista vazia sem consultar tenant_members", async () => {
    getSessionMock.mockResolvedValue({ userId: "staff-1", isWjbStaff: true });
    const response = await getMyOrganizations();
    const json = await response.json();

    expect(json.organizations).toEqual([]);
    expect(getMyOrganizationsMock).not.toHaveBeenCalled();
  });

  it("cliente recebe as empresas vinculadas com o papel de cada uma", async () => {
    getSessionMock.mockResolvedValue({ userId: "client-1", isWjbStaff: false });
    getMyOrganizationsMock.mockResolvedValue([
      { id: "tenant-1", name: "Empresa X", cnpj: "123", role: "owner" },
    ]);

    const response = await getMyOrganizations();
    const json = await response.json();

    expect(json.organizations).toEqual([
      { id: "tenant-1", name: "Empresa X", cnpj: "123", role: "owner" },
    ]);
  });
});
