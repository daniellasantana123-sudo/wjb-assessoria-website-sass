import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/db/supabase/admin", () => ({ createAdminClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));
vi.mock("@/lib/db/supabase/server", () => ({ isSupabaseConfigured: () => true, createClient: vi.fn() }));
vi.mock("@/lib/db/supabase/client", () => ({}));

const { evaluateStepUp, STEP_UP_MAX_AGE_SECONDS } = await import("@/lib/auth/dal");
const { safeAppPath } = await import("@/lib/auth/safe-next");
const { clientIp, hashKey, isRateLimitedShared } = await import("@/lib/security/shared-rate-limit");

describe("step-up de MFA (Fase 10A)", () => {
  const now = 1_800_000_000;
  it("sem fator MFA, MFA pendente, MFA antigo e MFA recente", () => {
    expect(evaluateStepUp({ currentLevel: "aal1", nextLevel: "aal1" }, now)).toEqual({ ok: false, reason: "sem_mfa" });
    expect(evaluateStepUp({ currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [{ method: "password", timestamp: now }] }, now)).toEqual({ ok: false, reason: "mfa_pendente" });
    expect(evaluateStepUp({ currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [{ method: "totp", timestamp: now - STEP_UP_MAX_AGE_SECONDS - 1 }] }, now)).toEqual({ ok: false, reason: "mfa_antigo" });
    expect(evaluateStepUp({ currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [{ method: "password", timestamp: now }, { method: "totp", timestamp: now - 60 }] }, now)).toEqual({ ok: true });
  });
  it("senha recente não substitui o código do autenticador; formato antigo sem horário não conta", () => {
    expect(evaluateStepUp({ currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [{ method: "password", timestamp: now }] }, now).ok).toBe(false);
    expect(evaluateStepUp({ currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: ["totp"] }, now).ok).toBe(false);
    expect(evaluateStepUp(null, now)).toEqual({ ok: false, reason: "sem_mfa" });
  });
});

describe("retorno seguro depois de confirmar o MFA", () => {
  it("só caminhos internos do Portal e do Admin", () => {
    expect(safeAppPath("/admin/comercial")).toBe("/admin/comercial");
    expect(safeAppPath("/portal/plano?x=1")).toBe("/portal/plano?x=1");
    for (const bad of ["https://golpe.test", "//golpe.test", "/login", "/admin\\\\..", "javascript:alert(1)", 42, null, "/administrador"]) expect(safeAppPath(bad)).toBeNull();
  });
});

describe("limite compartilhado", () => {
  const rule = { scope: "teste", max: 2, windowSeconds: 60 };
  it("usa o banco com a chave em hash, nunca o IP em claro", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste");
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await isRateLimitedShared(rule, "203.0.113.9")).toBe(true);
    const args = rpc.mock.calls[0][1] as { p_bucket: string };
    expect(args.p_bucket).toBe(`teste:${hashKey("203.0.113.9")}`);
    expect(args.p_bucket).not.toContain("203.0.113.9");
    vi.unstubAllEnvs();
  });
  it("se o banco falhar, cai no contador em memória (não derruba o formulário)", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste");
    rpc.mockRejectedValue(new Error("fora do ar"));
    expect(await isRateLimitedShared(rule, "198.51.100.1")).toBe(false);
    expect(await isRateLimitedShared(rule, "198.51.100.1")).toBe(false);
    expect(await isRateLimitedShared(rule, "198.51.100.1")).toBe(true);
    vi.unstubAllEnvs();
  });
  it("na reserva em memória, regra por hora não barra o 2º envio legítimo (bug achado no teste)", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste");
    rpc.mockRejectedValue(new Error("fora do ar"));
    const hourly = { scope: "teste-hora", max: 30, windowSeconds: 3600 };
    for (let i = 0; i < 5; i++) expect(await isRateLimitedShared(hourly, "192.0.2.7")).toBe(false);
    vi.unstubAllEnvs();
  });
  it("IP: x-real-ip, depois o primeiro x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("desconhecido");
  });
});
