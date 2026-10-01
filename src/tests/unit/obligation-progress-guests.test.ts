import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/db/supabase/server", () => ({ createClient: vi.fn() }));
const person = (id: string, name: string) => ({ externalId: id, name, email: null, role: null });
vi.mock("@/integrations/omie-gclick", () => ({
  getOmieGClickAdapter: () => ({
    tasks: {
      listActivities: async () => ({ ok: true, data: [] }),
      listResponsibles: async () => ({ ok: true, data: [person("1", "Diego")] }),
      listGuests: async () => ({ ok: true, data: [person("1", "Diego"), person("2", "Daniella")] }),
    },
  }),
}));

const { getObligationProgress } = await import("@/lib/omie-gclick");

describe("andamento da obrigação", () => {
  it("mostra convidados sem repetir quem já é responsável", async () => {
    const progress = await getObligationProgress("4.1");
    expect(progress?.responsibles.map((p) => p.name)).toEqual(["Diego"]);
    expect(progress?.guests.map((p) => p.name)).toEqual(["Daniella"]);
  });
});
