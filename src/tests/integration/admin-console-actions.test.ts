import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSessionMock = vi.fn();
const requireTenantAccessMock = vi.fn();
const getTenantRoleMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireStaffSession: requireStaffSessionMock,
  requireTenantAccess: requireTenantAccessMock,
  getTenantRole: getTenantRoleMock,
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const tenantsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const tenantMembersRoleUpdateMock = vi.fn().mockResolvedValue({ error: null });
const tenantMembersDeleteMock = vi.fn().mockResolvedValue({ error: null });
const profilesMaybeSingleMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
const featureFlagsUpsertMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "tenants") {
    return { update: () => ({ eq: tenantsUpdateEqMock }) };
  }
  if (table === "tenant_members") {
    return {
      update: () => ({ eq: () => ({ eq: tenantMembersRoleUpdateMock }) }),
      delete: () => ({ eq: () => ({ eq: tenantMembersDeleteMock }) }),
    };
  }
  if (table === "profiles") {
    return { select: () => ({ eq: () => ({ maybeSingle: profilesMaybeSingleMock }) }) };
  }
  if (table === "audit_log") {
    return { insert: auditInsertMock };
  }
  if (table === "feature_flags") {
    return { upsert: featureFlagsUpsertMock };
  }
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const inviteUserByEmailMock = vi.fn().mockResolvedValue({ data: {}, error: null });
vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } } })),
}));

const {
  updateTenant,
  suspendTenant,
  reactivateTenant,
  updateMemberRole,
  revokeMemberAccess,
  resendMemberInvite,
} = await import("@/actions/tenants");
const { resendStaffInvite } = await import("@/actions/staff");
const { setFeatureFlag } = await import("@/actions/feature-flags");

function staffSession(staffRole: "super_admin" | "contador" | "atendimento" | null = "super_admin") {
  return { userId: "staff-1", email: "staff@wjb.com.br", isWjbStaff: true, staffRole };
}

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffSessionMock.mockResolvedValue(staffSession());
  requireTenantAccessMock.mockResolvedValue({ userId: "staff-1", isWjbStaff: true });
  getTenantRoleMock.mockResolvedValue("owner");
  tenantsUpdateEqMock.mockResolvedValue({ error: null });
  tenantMembersRoleUpdateMock.mockResolvedValue({ error: null });
  tenantMembersDeleteMock.mockResolvedValue({ error: null });
  auditInsertMock.mockResolvedValue({ error: null });
  featureFlagsUpsertMock.mockResolvedValue({ error: null });
  profilesMaybeSingleMock.mockResolvedValue({
    data: { email: "cliente@empresa.com.br", full_name: "Cliente" },
  });
  inviteUserByEmailMock.mockResolvedValue({ data: {}, error: null });
});

describe("updateTenant", () => {
  it("qualquer staff (não só super_admin) pode editar - organizations.manage é de base", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession("contador"));

    const result = await updateTenant(
      "tenant-1",
      undefined,
      formData({ name: "Empresa Nova", cnpj: "" }),
    );

    expect(result).toEqual({ success: expect.any(String) });
    expect(tenantsUpdateEqMock).toHaveBeenCalledWith("id", "tenant-1");
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant.updated", tenant_id: "tenant-1" }),
    );
  });

  it("rejeita nome vazio", async () => {
    const result = await updateTenant("tenant-1", undefined, formData({ name: "", cnpj: "" }));

    expect(result && "error" in result && result.error).toBeTruthy();
    expect(tenantsUpdateEqMock).not.toHaveBeenCalled();
  });
});

describe("suspendTenant / reactivateTenant - privilege escalation", () => {
  it("bloqueia contador/atendimento (só super_admin tem tenants.suspend)", async () => {
    for (const role of ["contador", "atendimento"] as const) {
      requireStaffSessionMock.mockResolvedValue(staffSession(role));
      await suspendTenant("tenant-1");
      expect(tenantsUpdateEqMock).not.toHaveBeenCalled();
    }
  });

  it("super_admin suspende a empresa inteira e grava auditoria", async () => {
    await suspendTenant("tenant-1");

    expect(tenantsUpdateEqMock).toHaveBeenCalledWith("id", "tenant-1");
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant.suspended", tenant_id: "tenant-1" }),
    );
  });

  it("super_admin reativa a empresa", async () => {
    await reactivateTenant("tenant-1");

    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant.reactivated" }),
    );
  });
});

describe("updateMemberRole / revokeMemberAccess - members.manage", () => {
  it("staff (qualquer staffRole) pode trocar o papel de um membro", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession("atendimento"));

    await updateMemberRole("tenant-1", "profile-2", "owner");

    expect(tenantMembersRoleUpdateMock).toHaveBeenCalled();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant_member.role_changed", metadata: { role: "owner" } }),
    );
  });

  it("revoga o acesso (delete, não só suspende) e grava auditoria", async () => {
    await revokeMemberAccess("tenant-1", "profile-2");

    expect(tenantMembersDeleteMock).toHaveBeenCalled();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant_member.access_revoked", entity_id: "profile-2" }),
    );
  });
});

describe("resendMemberInvite", () => {
  it("rejeita quem não é owner nem staff", async () => {
    getTenantRoleMock.mockResolvedValue("member");

    const result = await resendMemberInvite("tenant-1", "profile-2");

    expect(result).toEqual({ error: expect.stringContaining("responsável") });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
  });

  it("reenvia o convite pro e-mail do perfil e grava auditoria", async () => {
    const result = await resendMemberInvite("tenant-1", "profile-2");

    expect(result).toEqual({ success: expect.any(String) });
    expect(inviteUserByEmailMock).toHaveBeenCalledWith(
      "cliente@empresa.com.br",
      expect.objectContaining({ data: { full_name: "Cliente" } }),
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant_member.invite_resent" }),
    );
  });

  it("erro do Supabase (ex.: já aceitou) vira mensagem genérica, nunca lança", async () => {
    inviteUserByEmailMock.mockResolvedValue({ data: null, error: { message: "already registered" } });

    const result = await resendMemberInvite("tenant-1", "profile-2");

    expect(result && "error" in result && result.error).toBeTruthy();
  });
});

describe("resendStaffInvite - privilege escalation", () => {
  it("bloqueia contador/atendimento", async () => {
    requireStaffSessionMock.mockResolvedValue(staffSession("contador"));

    const result = await resendStaffInvite("profile-2");

    expect(result).toEqual({ error: expect.stringContaining("super_admin") });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
  });

  it("super_admin reenvia e grava auditoria", async () => {
    const result = await resendStaffInvite("profile-2");

    expect(result).toEqual({ success: expect.any(String) });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "staff.invite_resent" }),
    );
  });
});

describe("setFeatureFlag - privilege escalation", () => {
  it("bloqueia contador/atendimento (só super_admin tem feature_flags.manage)", async () => {
    for (const role of ["contador", "atendimento"] as const) {
      requireStaffSessionMock.mockResolvedValue(staffSession(role));
      await setFeatureFlag("documents", false);
      expect(featureFlagsUpsertMock).not.toHaveBeenCalled();
    }
  });

  it("super_admin desativa uma flag e grava auditoria", async () => {
    await setFeatureFlag("documents", false);

    expect(featureFlagsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "documents", enabled: false }),
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "feature_flag.updated", metadata: { enabled: false } }),
    );
  });
});
