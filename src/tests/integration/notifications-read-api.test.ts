import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  getSession: getSessionMock,
}));

const markNotificationAsReadAndGetLinkMock = vi.fn();
vi.mock("@/lib/notifications", () => ({
  markNotificationAsReadAndGetLink: markNotificationAsReadAndGetLinkMock,
}));

const { GET: markRead } = await import("@/app/api/notifications/[id]/read/route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/notifications/[id]/read", () => {
  it("responde 401 sem sessão", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await markRead(new Request("http://x"), makeParams("n1"));

    expect(response.status).toBe(401);
    expect(markNotificationAsReadAndGetLinkMock).not.toHaveBeenCalled();
  });

  it("responde 404 quando a notificação não existe (ou é de outra pessoa, via RLS)", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1" });
    markNotificationAsReadAndGetLinkMock.mockResolvedValue(null);

    const response = await markRead(new Request("http://x"), makeParams("n-de-outra-pessoa"));

    expect(response.status).toBe(404);
  });

  it("marca como lida e redireciona pro link real", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1" });
    markNotificationAsReadAndGetLinkMock.mockResolvedValue("/portal/suporte/1");

    const response = await markRead(new Request("http://x/api/notifications/n1/read"), makeParams("n1"));

    expect(markNotificationAsReadAndGetLinkMock).toHaveBeenCalledWith("n1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://x/portal/suporte/1");
  });
});
