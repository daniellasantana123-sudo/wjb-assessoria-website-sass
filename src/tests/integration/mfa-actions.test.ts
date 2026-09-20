import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionMock = vi.fn();
const getSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireSession: requireSessionMock,
  getSession: getSessionMock,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const mfaEnroll = vi.fn();
const mfaChallengeAndVerify = vi.fn();
const mfaUnenroll = vi.fn();
const mfaListFactors = vi.fn();
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      mfa: {
        enroll: mfaEnroll,
        challengeAndVerify: mfaChallengeAndVerify,
        unenroll: mfaUnenroll,
        listFactors: mfaListFactors,
      },
    },
  }),
}));

const {
  enrollTotpFactor,
  verifyTotpEnrollment,
  unenrollTotpFactor,
  listTotpFactors,
  verifyLoginMfaChallenge,
} = await import("@/actions/mfa");

beforeEach(() => {
  vi.clearAllMocks();
  requireSessionMock.mockResolvedValue({ userId: "u1", isWjbStaff: false });
});

describe("enrollTotpFactor", () => {
  it("retorna QR code e secret ao ter sucesso", async () => {
    mfaEnroll.mockResolvedValue({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,...", secret: "ABC123" } },
      error: null,
    });

    const result = await enrollTotpFactor();

    expect(result).toEqual({
      status: "enrolled",
      factorId: "factor-1",
      qrCode: "data:image/svg+xml,...",
      secret: "ABC123",
    });
  });

  it("retorna erro quando o Supabase falha", async () => {
    mfaEnroll.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await enrollTotpFactor();
    expect(result?.status).toBe("error");
  });
});

describe("verifyTotpEnrollment", () => {
  it("rejeita código que não tem 6 dígitos", async () => {
    const result = await verifyTotpEnrollment("factor-1", undefined, new FormData());
    expect(result).toEqual({ error: expect.stringContaining("6 dígitos") });
    expect(mfaChallengeAndVerify).not.toHaveBeenCalled();
  });

  it("confirma com código válido", async () => {
    mfaChallengeAndVerify.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("code", "123456");

    const result = await verifyTotpEnrollment("factor-1", undefined, formData);

    expect(mfaChallengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(result).toEqual({ success: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/portal/seguranca");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/seguranca");
  });

  it("retorna erro com código inválido", async () => {
    mfaChallengeAndVerify.mockResolvedValue({ error: { message: "invalid" } });
    const formData = new FormData();
    formData.set("code", "000000");

    const result = await verifyTotpEnrollment("factor-1", undefined, formData);
    expect(result).toEqual({ error: expect.stringContaining("inválido") });
  });
});

describe("unenrollTotpFactor", () => {
  it("chama unenroll e revalida as páginas de segurança", async () => {
    mfaUnenroll.mockResolvedValue({ data: { id: "factor-1" }, error: null });
    await unenrollTotpFactor("factor-1");
    expect(mfaUnenroll).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });
});

describe("listTotpFactors", () => {
  it("filtra só fatores totp e mapeia os campos", async () => {
    mfaListFactors.mockResolvedValue({
      data: {
        all: [
          { id: "f1", factor_type: "totp", status: "verified", created_at: "2026-01-01" },
          { id: "f2", factor_type: "phone", status: "verified", created_at: "2026-01-02" },
        ],
      },
      error: null,
    });

    const result = await listTotpFactors();
    expect(result).toEqual([{ id: "f1", status: "verified", createdAt: "2026-01-01" }]);
  });
});

describe("verifyLoginMfaChallenge", () => {
  it("redireciona pro login sem sessão", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(
      verifyLoginMfaChallenge(undefined, new FormData()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("rejeita código malformado sem chamar o Supabase", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", isWjbStaff: false });
    const result = await verifyLoginMfaChallenge(undefined, new FormData());
    expect(result).toEqual({ error: expect.stringContaining("6 dígitos") });
    expect(mfaListFactors).not.toHaveBeenCalled();
  });

  it("verifica o código e redireciona pro portal (cliente)", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", isWjbStaff: false });
    mfaListFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }] }, error: null });
    mfaChallengeAndVerify.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("code", "654321");

    await expect(verifyLoginMfaChallenge(undefined, formData)).rejects.toThrow(
      "REDIRECT:/portal",
    );
    expect(mfaChallengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "654321" });
  });

  it("verifica o código e redireciona pro admin (staff)", async () => {
    getSessionMock.mockResolvedValue({ userId: "staff-1", isWjbStaff: true });
    mfaListFactors.mockResolvedValue({ data: { totp: [{ id: "factor-2" }] }, error: null });
    mfaChallengeAndVerify.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("code", "111111");

    await expect(verifyLoginMfaChallenge(undefined, formData)).rejects.toThrow(
      "REDIRECT:/admin",
    );
  });
});
