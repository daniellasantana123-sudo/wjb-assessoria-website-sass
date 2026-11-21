import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const inserted: Record<string, unknown>[][] = [];
vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "profiles"
        ? { select: () => ({ eq: async () => ({ data: [{ id: "u1", email: "a@x.test", status: "active" }, { id: "u2", email: "b@x.test", status: "suspended" }] }) }) }
        : { insert: async (rows: Record<string, unknown>[]) => (inserted.push(rows), { error: null }) },
  }),
}));
vi.mock("@/lib/db/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: async () => true }));
const send = vi.fn();
vi.mock("@/integrations/email", () => ({ getEmailAdapter: () => ({ send }) }));

const { notifyNewLead } = await import("@/lib/notifications");

describe("aviso interno de novo lead (Fase 9.1)", () => {
  it("vai só para a equipe ativa, sem dado pessoal, sem e-mail duplicado e com link para Leads", async () => {
    await notifyNewLead({ formContext: "Contato <script>maria@x.com</script>" });
    expect(inserted).toHaveLength(1);
    const rows = inserted[0];
    expect(rows.map((r) => r.recipient_id)).toEqual(["u1"]);
    expect(rows[0]).toMatchObject({ type: "lead.created", link: "/admin/leads", tenant_id: null });
    expect(String(rows[0].body)).not.toMatch(/[<>@]/);
    expect(send).not.toHaveBeenCalled();
  });
});
