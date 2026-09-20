import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.fn();
const cookieSetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: cookieGetMock, set: cookieSetMock }),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const requireSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireSession: requireSessionMock }));

// getMyOrganizations encadeia dois .eq(): profile_id e status.
const eqMock = vi.fn();
const eqStatusMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const { getActiveTenant, getMyOrganizations } = await import("@/lib/tenant");
const { switchActiveTenant } = await import("@/actions/tenant-context");

const orgRows = [
  { role: "owner", tenants: { id: "tenant-1", name: "Empresa 1", cnpj: "111" } },
  { role: "member", tenants: { id: "tenant-2", name: "Empresa 2", cnpj: "222" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  eqMock.mockImplementation(() => ({ eq: eqStatusMock }));
  eqStatusMock.mockResolvedValue({ data: orgRows });
});

describe("getMyOrganizations", () => {
  it("mapeia todas as empresas vinculadas", async () => {
    const result = await getMyOrganizations("user-1");
    expect(result).toEqual([
      { id: "tenant-1", name: "Empresa 1", cnpj: "111", role: "owner" },
      { id: "tenant-2", name: "Empresa 2", cnpj: "222", role: "member" },
    ]);
  });
});

describe("getActiveTenant", () => {
  it("usa a primeira empresa quando não há cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const result = await getActiveTenant("user-1");
    expect(result?.id).toBe("tenant-1");
  });

  it("usa a empresa do cookie quando o usuário é membro dela", async () => {
    cookieGetMock.mockReturnValue({ value: "tenant-2" });
    const result = await getActiveTenant("user-1");
    expect(result?.id).toBe("tenant-2");
  });

  it("ignora um cookie apontando pra empresa que o usuário não é membro (nunca confia sozinho)", async () => {
    cookieGetMock.mockReturnValue({ value: "tenant-fantasma" });
    const result = await getActiveTenant("user-1");
    expect(result?.id).toBe("tenant-1");
  });

  it("retorna null quando o usuário não tem nenhuma empresa", async () => {
    eqStatusMock.mockResolvedValue({ data: [] });
    const result = await getActiveTenant("user-1");
    expect(result).toBeNull();
  });
});

describe("switchActiveTenant", () => {
  it("grava o cookie e redireciona quando o usuário é membro da empresa", async () => {
    requireSessionMock.mockResolvedValue({ userId: "user-1" });
    const formData = new FormData();
    formData.set("tenantId", "tenant-2");

    await expect(switchActiveTenant(formData)).rejects.toThrow("REDIRECT:/portal");

    expect(cookieSetMock).toHaveBeenCalledWith(
      "active_tenant_id",
      "tenant-2",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("ignora silenciosamente uma empresa que o usuário não é membro", async () => {
    requireSessionMock.mockResolvedValue({ userId: "user-1" });
    const formData = new FormData();
    formData.set("tenantId", "tenant-de-outra-empresa");

    await switchActiveTenant(formData);

    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
