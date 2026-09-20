import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const listSelectMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "feature_flags") {
    return {
      select: (columns: string) => {
        if (columns === "enabled") return { eq: () => ({ maybeSingle: maybeSingleMock }) };
        return listSelectMock();
      },
    };
  }
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

const { isFeatureEnabled, listFeatureFlags, FEATURE_FLAG_LABELS } = await import(
  "@/lib/feature-flags"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFeatureEnabled", () => {
  it("retorna o valor salvo quando a linha existe", async () => {
    maybeSingleMock.mockResolvedValue({ data: { enabled: false } });
    expect(await isFeatureEnabled("documents")).toBe(false);
  });

  it("cai em 'true' (nunca quebra quem chamou) quando a linha não existe", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    expect(await isFeatureEnabled("omie_gclick")).toBe(true);
  });
});

describe("listFeatureFlags", () => {
  it("devolve as 3 flags conhecidas, mesmo se o banco não tiver todas as linhas", async () => {
    listSelectMock.mockResolvedValue({
      data: [{ key: "documents", enabled: false, updated_at: "2026-09-20T10:00:00Z" }],
    });

    const flags = await listFeatureFlags();

    expect(flags).toHaveLength(Object.keys(FEATURE_FLAG_LABELS).length);
    expect(flags.find((f) => f.key === "documents")).toEqual({
      key: "documents",
      label: FEATURE_FLAG_LABELS.documents,
      enabled: false,
      updatedAt: "2026-09-20T10:00:00Z",
    });
    expect(flags.find((f) => f.key === "notifications")).toEqual(
      expect.objectContaining({ enabled: true, updatedAt: null }),
    );
  });
});
