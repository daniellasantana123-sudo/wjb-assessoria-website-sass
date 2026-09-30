import { afterEach, describe, expect, it, vi } from "vitest";

const notifyObligationEventMock = vi.fn();
vi.mock("@/lib/notifications", () => ({ notifyObligationEvent: notifyObligationEventMock }));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/db/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));

const { POST } = await import("@/app/api/cron/lembretes-obrigacoes/route");

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/lembretes-obrigacoes", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  }) as unknown as Parameters<typeof POST>[0];
}

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

describe("POST /api/cron/lembretes-obrigacoes", () => {
  it("sem CRON_SECRET configurado, recusa (503) e não toca no banco", async () => {
    const response = await POST(request("Bearer qualquer"));
    expect(response.status).toBe(503);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("com segredo errado ou ausente, 401", async () => {
    process.env.CRON_SECRET = "segredo-certo";
    expect((await POST(request("Bearer errado"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("com o segredo certo, avisa uma vez por empresa e pula o que já foi avisado hoje", async () => {
    process.env.CRON_SECRET = "segredo-certo";
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const obligationsQuery = {
      select: () => obligationsQuery,
      eq: () => obligationsQuery,
      in: () => obligationsQuery,
      neq: () =>
        Promise.resolve({
          data: [
            { id: "a", tenant_id: "t1", title: "DAS", due_date: iso },
            { id: "b", tenant_id: "t2", title: "FGTS", due_date: iso },
          ],
          error: null,
        }),
    };
    const countFor = { t1: 0, t2: 1 } as Record<string, number>;
    let currentTenant = "";
    const notificationsQuery = {
      select: () => notificationsQuery,
      eq: (column: string, value: string) => {
        if (column === "tenant_id") currentTenant = value;
        return notificationsQuery;
      },
      contains: () => Promise.resolve({ count: countFor[currentTenant] }),
    };
    createAdminClientMock.mockReturnValue({
      from: (table: string) => (table === "obligations" ? obligationsQuery : notificationsQuery),
    });

    const response = await POST(request("Bearer segredo-certo"));
    const body = await response.json();

    expect(body).toMatchObject({ ok: true, sent: 1, skipped: 1 });
    expect(notifyObligationEventMock).toHaveBeenCalledTimes(1);
    expect(notifyObligationEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", kind: "due_today", actorId: null }),
    );
  });
});
