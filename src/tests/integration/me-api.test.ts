import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mocka a DAL de sessão e `getMyPrimaryTenant` (não o Supabase client
 * diretamente) — mesmo racional de `leads-api.test.ts`: testar
 * roteamento/formato de resposta sem depender de um Supabase real. A
 * cobertura de RLS/sessão de verdade é o `portal-auth.spec.ts` (Playwright).
 */
const getSessionMock = vi.fn();
const getTenantRoleMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  getSession: getSessionMock,
  getTenantRole: getTenantRoleMock,
}));

const getMyPrimaryTenantMock = vi.fn();
vi.mock("@/lib/tenant", () => ({
  getMyPrimaryTenant: getMyPrimaryTenantMock,
}));

const { GET: getMe } = await import("@/app/api/me/route");

beforeEach(() => {
  getSessionMock.mockReset();
  getTenantRoleMock.mockReset();
  getMyPrimaryTenantMock.mockReset();
});

describe("GET /api/me", () => {
  it("responde 401 sem sessão", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await getMe();
    expect(response.status).toBe(401);
  });

  it("staff não tem organizationId nem role, mas tem permissões de staff", async () => {
    getSessionMock.mockResolvedValue({
      userId: "staff-1",
      email: "staff@wjb.com.br",
      fullName: "Staff",
      isWjbStaff: true,
      staffRole: "super_admin",
    });

    const response = await getMe();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.organizationId).toBeNull();
    expect(json.role).toBeNull();
    expect(json.permissions).toContain("staff.manage");
    expect(getMyPrimaryTenantMock).not.toHaveBeenCalled();
  });

  it("cliente com empresa recebe organizationId, role e permissões de tenant", async () => {
    getSessionMock.mockResolvedValue({
      userId: "client-1",
      email: "cliente@empresa.com.br",
      fullName: "Cliente",
      isWjbStaff: false,
      staffRole: null,
    });
    getMyPrimaryTenantMock.mockResolvedValue({ id: "tenant-1", name: "Empresa X", cnpj: "123" });
    getTenantRoleMock.mockResolvedValue("owner");

    const response = await getMe();
    const json = await response.json();

    expect(json.organizationId).toBe("tenant-1");
    expect(json.role).toBe("owner");
    expect(json.permissions).toContain("members.invite");
    expect(json.permissions).not.toContain("staff.manage");
  });

  it("cliente sem empresa vinculada recebe organizationId e role nulos", async () => {
    getSessionMock.mockResolvedValue({
      userId: "client-2",
      email: "sememp@empresa.com.br",
      fullName: "Sem Empresa",
      isWjbStaff: false,
      staffRole: null,
    });
    getMyPrimaryTenantMock.mockResolvedValue(null);

    const response = await getMe();
    const json = await response.json();

    expect(json.organizationId).toBeNull();
    expect(json.role).toBeNull();
    expect(json.permissions).toEqual([]);
    expect(getTenantRoleMock).not.toHaveBeenCalled();
  });
});
