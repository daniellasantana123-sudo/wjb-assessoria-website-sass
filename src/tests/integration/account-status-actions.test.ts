import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireStaffSession: requireStaffSessionMock,
}));

const isSuperAdminMock = vi.fn();
vi.mock("@/lib/permissions/roles", () => ({
  isSuperAdmin: isSuperAdminMock,
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const notifyAccountSecurityMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications", () => ({
  notifyAccountSecurity: notifyAccountSecurityMock,
}));

const profilesUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const tenantMembersUpdateEqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
const profilesMaybeSingleMock = vi.fn().mockResolvedValue({ data: { email: "pessoa@empresa.com.br" } });
const tenantsMaybeSingleMock = vi.fn().mockResolvedValue({ data: { name: "Empresa X" } });
const fromMock = vi.fn((table: string) => {
  if (table === "profiles") {
    return {
      update: vi.fn(() => ({ eq: profilesUpdateEqMock })),
      select: () => ({ eq: () => ({ maybeSingle: profilesMaybeSingleMock }) }),
    };
  }
  if (table === "tenant_members") {
    return { update: vi.fn(() => ({ eq: tenantMembersUpdateEqMock })) };
  }
  if (table === "tenants") {
    return { select: () => ({ eq: () => ({ maybeSingle: tenantsMaybeSingleMock }) }) };
  }
  if (table === "audit_log") {
    return { insert: auditInsertMock };
  }
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const updateUserByIdMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById: updateUserByIdMock } } })),
}));

const { suspendAccount, reactivateAccount } = await import("@/actions/staff");
const { suspendMember, reactivateMember } = await import("@/actions/tenants");

beforeEach(() => {
  vi.clearAllMocks();
  profilesUpdateEqMock.mockResolvedValue({ error: null });
  updateUserByIdMock.mockResolvedValue({ error: null });
});

describe("suspendAccount / reactivateAccount", () => {
  it("não faz nada se quem chama não é super_admin", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });
    isSuperAdminMock.mockReturnValue(false);

    await suspendAccount("profile-2");

    expect(fromMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("não permite se auto-suspender", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });
    isSuperAdminMock.mockReturnValue(true);

    await suspendAccount("admin-1");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("suspende: atualiza profiles.status e chama updateUserById com ban_duration", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });
    isSuperAdminMock.mockReturnValue(true);

    await suspendAccount("profile-2");

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(profilesUpdateEqMock).toHaveBeenCalledWith("id", "profile-2");
    expect(updateUserByIdMock).toHaveBeenCalledWith("profile-2", {
      ban_duration: "876000h",
    });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account.suspended", entity_id: "profile-2" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/usuarios");
    expect(notifyAccountSecurityMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "profile-2", recipientEmail: "pessoa@empresa.com.br" }),
    );
  });

  it("reativa: atualiza profiles.status e remove o ban_duration", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });
    isSuperAdminMock.mockReturnValue(true);

    await reactivateAccount("profile-2");

    expect(updateUserByIdMock).toHaveBeenCalledWith("profile-2", { ban_duration: "none" });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account.reactivated" }),
    );
  });
});

describe("suspendMember / reactivateMember", () => {
  it("suspende o vínculo com a empresa e grava auditoria com tenant_id", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });

    await suspendMember("tenant-1", "profile-2");

    expect(fromMock).toHaveBeenCalledWith("tenant_members");
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant_member.suspended",
        tenant_id: "tenant-1",
        entity_id: "profile-2",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/empresas/tenant-1");
    expect(notifyAccountSecurityMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "profile-2", tenantId: "tenant-1" }),
    );
  });

  it("reativa o vínculo com a empresa", async () => {
    requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });

    await reactivateMember("tenant-1", "profile-2");

    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant_member.reactivated" }),
    );
  });
});
