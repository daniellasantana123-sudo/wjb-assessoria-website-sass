import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  OfficialSefinTransport,
  SEFIN_API_CONTRACT,
  SefinIndeterminateError,
  type SefinHttpClient,
  type SefinHttpRequest,
  type SefinHttpResponse,
} from "@/lib/wjb-ai/fiscal/national/official-transport";

class FakeClient implements SefinHttpClient {
  readonly kind = "falso-teste" as const;
  requests: SefinHttpRequest[] = [];
  constructor(private readonly reply: (r: SefinHttpRequest) => SefinHttpResponse) {}
  async send(r: SefinHttpRequest) {
    this.requests.push(r);
    return this.reply(r);
  }
}

const KEY = "3".repeat(50);
const ctx = { certificateHolderDocument: "00000000000000" };

describe("Fase 10F: contrato da API Nacional conferido no manual oficial", () => {
  it("caminhos de emissão, DPS, consulta e eventos citam o Manual dos Contribuintes v1.0", () => {
    for (const k of ["emitPath", "dpsPath", "eventPath", "nfseQueryPath", "eventQueryPath"] as const) {
      expect(SEFIN_API_CONTRACT[k].status, k).toBe("confirmado");
      expect(SEFIN_API_CONTRACT[k].source, k).toMatch(/Manual dos Contribuintes - Emissor Público Nacional API v1\.0 \(17\/03\/2025\)/);
    }
    // A base da API é deduzida do endereço do swagger: não está confirmada.
    expect(SEFIN_API_CONTRACT.baseUrl.status).toBe("inferido");
  });
});

describe("Fase 10F: consulta da NFS-e pela chave (GET /nfse/{chaveAcesso})", () => {
  it("monta GET no caminho oficial; 2xx = encontrada; 404 = não encontrada", async () => {
    const c = new FakeClient((r) => (r.url.pathname.endsWith(KEY) ? { status: 200, body: "{}" } : { status: 404, body: "" }));
    const t = new OfficialSefinTransport(c);
    await expect(t.queryNfse(KEY)).resolves.toEqual({ found: true, nfseXml: undefined });
    expect(c.requests[0]).toMatchObject({ method: "GET" });
    expect(c.requests[0].url.href).toBe(`https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse/${KEY}`);
    await expect(t.queryNfse("4".repeat(50))).resolves.toEqual({ found: false });
  });

  it("403, 5xx e qualquer outra resposta são indeterminados (nada é concluído)", async () => {
    for (const status of [403, 500, 502, 302]) {
      const t = new OfficialSefinTransport(new FakeClient(() => ({ status, body: "" })));
      await expect(t.queryNfse(KEY)).rejects.toBeInstanceOf(SefinIndeterminateError);
    }
  });

  it("recusa chave fora do formato antes de qualquer chamada", async () => {
    const c = new FakeClient(() => ({ status: 200, body: "{}" }));
    const t = new OfficialSefinTransport(c);
    await expect(t.queryNfse("../x")).rejects.toThrow(/Chave de acesso inválida/);
    expect(c.requests).toHaveLength(0);
    void ctx;
  });
});

describe("Fase 10F: consulta no transporte simulado segue a regra de sigilo", () => {
  it("ator da nota consulta; terceiro é recusado; chave desconhecida = não encontrada", async () => {
    const { SimulatedSefinTransport } = await import("@/lib/wjb-ai/fiscal/national/simulated-transport");
    const t = new SimulatedSefinTransport();
    (t as unknown as { generated: Map<string, { accessKey: string; emitter: string; taker: string }> }).generated.set("DPS1", {
      accessKey: KEY,
      emitter: "11111111000111",
      taker: "22222222000122",
    });
    await expect(t.queryNfse(KEY, { certificateHolderDocument: "11111111000111" })).resolves.toEqual({ found: true });
    await expect(t.queryNfse(KEY, { certificateHolderDocument: "22222222000122" })).resolves.toEqual({ found: true });
    await expect(t.queryNfse(KEY, { certificateHolderDocument: "99999999000199" })).rejects.toThrow(/403/);
    await expect(t.queryNfse("5".repeat(50), { certificateHolderDocument: "11111111000111" })).resolves.toEqual({ found: false });
  });
});
