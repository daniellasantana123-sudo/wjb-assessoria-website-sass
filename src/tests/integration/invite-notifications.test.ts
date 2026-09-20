import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantAccessMock = vi.fn();
const getTenantRoleMock = vi.fn();
const requireStaffSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireTenantAccess: requireTenantAccessMock,
  getTenantRole: getTenantRoleMock,
  requireStaffSession: requireStaffSessionMock,
}));

const isSuperAdminMock = vi.fn().mockReturnValue(true);
vi.mock("@/lib/permissions/roles", () => ({ isSuperAdmin: isSuperAdminMock }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const notifyInvitationMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications", () => ({ notifyInvitation: notifyInvitationMock }));

const profilesExistingMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const profilesUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const tenantMembersInsertMock = vi.fn().mockResolvedValue({ error: null });
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });

function makeFrom(client: "admin" | "server") {
  return vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: profilesExistingMaybeSingleMock }) }),
        update: () => ({ eq: profilesUpdateEqMock }),
      };
    }
    if (table === "tenant_members") return { insert: tenantMembersInsertMock };
    if (table === "audit_log") return { insert: auditInsertMock };
    throw new Error(`tabela inesperada (${client}): ${table}`);
  });
}

const adminFromMock = makeFrom("admin");
const serverFromMock = makeFrom("server");

const inviteUserByEmailMock = vi.fn().mockResolvedValue({ data: { user: { id: "new-profile-1" } }, error: null });
vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock, auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } } }),
}));
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: serverFromMock }),
}));

const { inviteMember } = await import("@/actions/tenants");
const { inviteStaffMember } = await import("@/actions/staff");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isSuperAdminMock.mockReturnValue(true);
  profilesExistingMaybeSingleMock.mockResolvedValue({ data: null });
  inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: "new-profile-1" } }, error: null });
  tenantMembersInsertMock.mockResolvedValue({ error: null });
  profilesUpdateEqMock.mockResolvedValue({ error: null });
  requireTenantAccessMock.mockResolvedValue({ userId: "owner-1" });
  getTenantRoleMock.mockResolvedValue("owner");
  requireStaffSessionMock.mockResolvedValue({ userId: "admin-1" });
});

describe("inviteMember - notificação de convite (Fase 6)", () => {
  it("dispara notifyInvitation com tenantId e link do Portal", async () => {
    const result = await inviteMember(
      "tenant-1",
      undefined,
      formData({ email: "novo@empresa.com.br", fullName: "Novo Membro", role: "member" }),
    );

    expect(result).toEqual({ success: expect.any(String) });
    expect(notifyInvitationMock).toHaveBeenCalledWith({
      recipientId: "new-profile-1",
      recipientEmail: "novo@empresa.com.br",
      tenantId: "tenant-1",
      link: "/portal",
    });
  });
});

describe("inviteStaffMember - notificação de convite (Fase 6)", () => {
  it("dispara notifyInvitation com link do Admin, sem tenantId", async () => {
    const result = await inviteStaffMember(
      undefined,
      formData({ email: "novo@wjb.com.br", fullName: "Novo Staff", staffRole: "contador" }),
    );

    expect(result).toEqual({ success: expect.any(String) });
    expect(notifyInvitationMock).toHaveBeenCalledWith({
      recipientId: "new-profile-1",
      recipientEmail: "novo@wjb.com.br",
      link: "/admin",
    });
  });
});
