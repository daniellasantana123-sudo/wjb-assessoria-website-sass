import { describe, expect, it } from "vitest";

import { getPermissions, hasPermission } from "@/lib/permissions/permissions";
import type { Session } from "@/lib/auth/dal";

function staffSession(staffRole: Session["staffRole"]): Session {
  return {
    userId: "staff-1",
    email: "staff@wjb.com.br",
    fullName: "Staff",
    isWjbStaff: true,
    staffRole,
  };
}

function clientSession(): Session {
  return {
    userId: "client-1",
    email: "cliente@empresa.com.br",
    fullName: "Cliente",
    isWjbStaff: false,
    staffRole: null,
  };
}

describe("hasPermission - staff", () => {
  it("super_admin tem staff.manage e todas as demais permissões", () => {
    const session = staffSession("super_admin");
    expect(hasPermission(session, "staff.manage")).toBe(true);
    expect(hasPermission(session, "organizations.manage")).toBe(true);
    expect(hasPermission(session, "audit.read")).toBe(true);
  });

  it("contador e atendimento não têm staff.manage, mas têm o resto", () => {
    for (const role of ["contador", "atendimento"] as const) {
      const session = staffSession(role);
      expect(hasPermission(session, "staff.manage")).toBe(false);
      expect(hasPermission(session, "obligations.manage")).toBe(true);
      expect(hasPermission(session, "documents.upload")).toBe(true);
      expect(hasPermission(session, "tickets.manage")).toBe(true);
    }
  });

  it("staff sem staffRole não tem nenhuma permissão", () => {
    const session = staffSession(null);
    expect(getPermissions(session)).toEqual([]);
  });
});

describe("hasPermission - cliente (tenant)", () => {
  it("owner pode convidar membro, member não", () => {
    const session = clientSession();
    expect(hasPermission(session, "members.invite", "owner")).toBe(true);
    expect(hasPermission(session, "members.invite", "member")).toBe(false);
  });

  it("owner e member têm as mesmas permissões de documentos/obrigações/tickets", () => {
    const session = clientSession();
    for (const role of ["owner", "member"] as const) {
      expect(hasPermission(session, "documents.upload", role)).toBe(true);
      expect(hasPermission(session, "obligations.read", role)).toBe(true);
      expect(hasPermission(session, "tickets.create", role)).toBe(true);
    }
  });

  it("cliente nunca tem permissão exclusiva de staff", () => {
    const session = clientSession();
    expect(hasPermission(session, "staff.manage", "owner")).toBe(false);
    expect(hasPermission(session, "audit.read", "owner")).toBe(false);
  });

  it("sem tenantRole, cliente não tem nenhuma permissão", () => {
    const session = clientSession();
    expect(getPermissions(session)).toEqual([]);
    expect(hasPermission(session, "organizations.read")).toBe(false);
  });
});
