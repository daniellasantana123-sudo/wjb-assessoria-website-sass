import { beforeEach, describe, expect, it, vi } from "vitest";

/** Query builder falso: todo método de filtro devolve `this` e encadeia; `then` resolve com `{data}`. */
function fakeQueryBuilder(data: unknown[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {
    calls,
    then: (resolve: (value: { data: unknown[] }) => void) => resolve({ data }),
  };
  for (const method of ["select", "order", "limit", "eq", "in", "gte", "lte", "ilike"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  return builder;
}

const auditLogRows = [
  {
    id: "log-1",
    action: "tenant.created",
    entity: "tenant",
    entity_id: "tenant-1",
    metadata: null,
    created_at: "2026-09-20T10:00:00Z",
    profiles: { full_name: "Staff", email: "staff@wjb.com.br" },
    tenants: { name: "Empresa X" },
  },
];

let auditLogBuilder = fakeQueryBuilder(auditLogRows);
const profilesByNameBuilder = { ilike: vi.fn() };
const profilesByEmailBuilder = { ilike: vi.fn() };

const fromMock = vi.fn((table: string) => {
  if (table === "audit_log") return auditLogBuilder;
  if (table === "profiles") {
    return {
      select: () => ({
        ilike: (column: string, value: string) => {
          if (column === "full_name") return profilesByNameBuilder.ilike(column, value);
          return profilesByEmailBuilder.ilike(column, value);
        },
      }),
      order: () => Promise.resolve({ data: [{ id: "tenant-owner-1", name: "Empresa X" }] }),
    };
  }
  if (table === "tenants") {
    return { select: () => ({ order: () => Promise.resolve({ data: [{ id: "t1", name: "Empresa X" }] }) }) };
  }
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const { listAuditLog, listTenantOptions } = await import("@/lib/audit-log");

beforeEach(() => {
  vi.clearAllMocks();
  auditLogBuilder = fakeQueryBuilder(auditLogRows);
  fromMock.mockImplementation((table: string) => {
    if (table === "audit_log") return auditLogBuilder;
    if (table === "profiles") {
      return {
        select: () => ({
          ilike: (column: string, value: string) => {
            if (column === "full_name") return profilesByNameBuilder.ilike(column, value);
            return profilesByEmailBuilder.ilike(column, value);
          },
        }),
      };
    }
    if (table === "tenants") {
      return { select: () => ({ order: () => Promise.resolve({ data: [{ id: "t1", name: "Empresa X" }] }) }) };
    }
    throw new Error(`tabela inesperada: ${table}`);
  });
  profilesByNameBuilder.ilike.mockReturnValue({ limit: () => Promise.resolve({ data: [] }) });
  profilesByEmailBuilder.ilike.mockReturnValue({ limit: () => Promise.resolve({ data: [] }) });
});

describe("listAuditLog", () => {
  it("sem filtro nenhum, não aplica eq/in/gte/lte", async () => {
    await listAuditLog();

    const methods = (auditLogBuilder.calls as { method: string }[]).map((c) => c.method);
    expect(methods).not.toContain("eq");
    expect(methods).not.toContain("in");
  });

  it("filtro por empresa aplica eq('tenant_id', ...)", async () => {
    await listAuditLog({ tenantId: "tenant-1" });

    expect(auditLogBuilder.calls).toContainEqual({ method: "eq", args: ["tenant_id", "tenant-1"] });
  });

  it("filtro por ação aplica eq('action', ...)", async () => {
    await listAuditLog({ action: "tenant.created" });

    expect(auditLogBuilder.calls).toContainEqual({ method: "eq", args: ["action", "tenant.created"] });
  });

  it("filtro por período aplica gte/lte em created_at", async () => {
    await listAuditLog({ dateFrom: "2026-09-01", dateTo: "2026-09-20" });

    expect(auditLogBuilder.calls).toContainEqual({
      method: "gte",
      args: ["created_at", "2026-09-01T00:00:00"],
    });
    expect(auditLogBuilder.calls).toContainEqual({
      method: "lte",
      args: ["created_at", "2026-09-20T23:59:59"],
    });
  });

  it("filtro por usuário busca em profiles (nome e e-mail) e filtra por actor_id in (...)", async () => {
    profilesByNameBuilder.ilike.mockReturnValue({
      limit: () => Promise.resolve({ data: [{ id: "profile-1" }] }),
    });

    await listAuditLog({ actorQuery: "Daniella" });

    expect(profilesByNameBuilder.ilike).toHaveBeenCalledWith("full_name", "%Daniella%");
    expect(profilesByEmailBuilder.ilike).toHaveBeenCalledWith("email", "%Daniella%");
    expect(auditLogBuilder.calls).toContainEqual({ method: "in", args: ["actor_id", ["profile-1"]] });
  });

  it("busca por usuário sem nenhum resultado retorna lista vazia sem consultar audit_log", async () => {
    const result = await listAuditLog({ actorQuery: "ninguem-existe" });

    expect(result).toEqual([]);
  });

  it("mapeia as linhas retornadas (actor/tenant embutidos)", async () => {
    const result = await listAuditLog();

    expect(result).toEqual([
      expect.objectContaining({
        id: "log-1",
        action: "tenant.created",
        actorName: "Staff",
        tenantName: "Empresa X",
      }),
    ]);
  });
});

describe("listTenantOptions", () => {
  it("devolve a lista enxuta pro filtro", async () => {
    const result = await listTenantOptions();
    expect(result).toEqual([{ id: "t1", name: "Empresa X" }]);
  });
});
