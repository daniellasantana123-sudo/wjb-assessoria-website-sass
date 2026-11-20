import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  buildDpsId,
  dpsIdMatches,
  InvalidDpsIdError,
} from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  FiscalParametersMissingError,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  InMemoryDpsNumberAllocator,
  NationalNFSeProvider,
} from "@/lib/wjb-ai/fiscal/national/provider";
import { SimulatedSefinTransport } from "@/lib/wjb-ai/fiscal/national/simulated-transport";
import {
  createMtlsSefinTransport,
  TransportNotAvailableError,
} from "@/lib/wjb-ai/fiscal/national/transport";
import {
  processQueue,
  type QueueJob,
  type QueueRepo,
} from "@/lib/wjb-ai/fiscal/queue";
import { canTransition, type FiscalStatus } from "@/lib/wjb-ai/fiscal/status";

// Dados FICTÍCIOS. Parâmetros fiscais de teste: valores de exemplo só para o
// conector simulado - em produção vêm do perfil aprovado pelo contador.
const emitter = {
  municipalityIbge: "3550308",
  documentKind: "CNPJ" as const,
  document: "11222333000181",
};
const params: FiscalParameters = {
  cTribNac: "010101",
  cLocPrestacao: "3550308",
  tribISSQN: "1",
  tpRetISSQN: "1",
  opSimpNac: "1",
  regEspTrib: "0",
  indTotTrib: "0",
};
const draft = {
  serviceDescription: "Serviço fictício",
  amountCents: 25000,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF" as const,
    name: "Tomador Fictício",
  },
};

function setup() {
  const transport = new SimulatedSefinTransport();
  const allocator = new InMemoryDpsNumberAllocator(1);
  const provider = new NationalNFSeProvider({
    transport,
    allocator,
    emitterFor: async () => emitter,
    parametersFor: async () => params,
    now: () => new Date("2026-11-20T12:00:00-03:00"),
  });
  return { transport, allocator, provider };
}

describe("identificador da DPS (Anexo I v1.01, regra 139 / E0004)", () => {
  it("tem 45 posições: DPS + município + tipo + inscrição + série + número", () => {
    const id = buildDpsId({ ...emitter, series: 1, number: 42 });
    expect(id).toBe(
      "DPS" + "3550308" + "2" + "11222333000181" + "00001" + "000000000000042",
    );
    expect(id).toHaveLength(45);
  });
  it("CPF usa tipo 1 e completa com zeros à esquerda até 14", () => {
    const id = buildDpsId({
      municipalityIbge: "3550308",
      documentKind: "CPF",
      document: "529.982.247-25",
      series: 900,
      number: 1,
    });
    expect(id.slice(10, 11)).toBe("1");
    expect(id.slice(11, 25)).toBe("00052998224725");
  });
  it("recusa partes inválidas e detecta id divergente", () => {
    expect(() =>
      buildDpsId({
        ...emitter,
        municipalityIbge: "355030",
        series: 1,
        number: 1,
      }),
    ).toThrow(InvalidDpsIdError);
    expect(() => buildDpsId({ ...emitter, series: 0, number: 1 })).toThrow(
      InvalidDpsIdError,
    );
    expect(() =>
      buildDpsId({
        ...emitter,
        document: "12ABC34501DE35",
        series: 1,
        number: 1,
      }),
    ).toThrow(/alfanumérico/);
    expect(
      dpsIdMatches(buildDpsId({ ...emitter, series: 1, number: 1 }), {
        ...emitter,
        series: 1,
        number: 2,
      }),
    ).toBe(false);
  });
});

describe("montagem da DPS", () => {
  const base = {
    dpsId: buildDpsId({ ...emitter, series: 1, number: 1 }),
    environment: "homologacao" as const,
    series: 1,
    number: 1,
    issuedAt: "2026-11-20T12:00:00-03:00",
    emitter,
    draft,
  };
  it("usa os grupos oficiais e tpAmb 2 (homologação)", () => {
    const xml = buildDpsXml({ ...base, params });
    for (const el of [
      "<infDPS Id=",
      "<tpAmb>2</tpAmb>",
      "<prest>",
      "<regTrib>",
      "<toma>",
      "<serv>",
      "<locPrest>",
      "<cServ>",
      "<cTribNac>010101</cTribNac>",
      "<vServ>250.00</vServ>",
      "<tribMun>",
      "<totTrib>",
    ]) {
      expect(xml).toContain(el);
    }
  });
  it("sem parametrização do contador, recusa em vez de inventar", () => {
    expect(() => buildDpsXml({ ...base, params: {} })).toThrow(
      FiscalParametersMissingError,
    );
    expect(() =>
      buildDpsXml({ ...base, params: { ...params, cTribNac: "123" } }),
    ).toThrow(/6 dígitos/);
  });
  it("grupo IBS/CBS só com implementação completa e decisão do contador", () => {
    expect(() =>
      buildDpsXml({
        ...base,
        params: { ...params, ibsCbs: { informar: true } },
      }),
    ).toThrow(/IBSCBS/);
  });
  it("escapa texto do cliente no XML", () => {
    const xml = buildDpsXml({
      ...base,
      params,
      draft: { ...draft, serviceDescription: "Corte & escova <teste>" },
    });
    expect(xml).toContain("Corte &amp; escova &lt;teste&gt;");
  });
});

describe("conector nacional contra o transporte simulado", () => {
  it("emite: corpo GZip+Base64, autorizada e SIMULADA", async () => {
    const { provider, transport } = setup();
    const out = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(out).toMatchObject({ status: "AUTORIZADA", simulated: true });
    expect(transport.emitCalls).toBe(1);
  });

  it("timeout depois de gerar a nota: consulta pelo mesmo número e NÃO gera segunda nota", async () => {
    const { provider, transport } = setup();
    transport.failNextEmitWithTimeout = true;
    const first = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(first.status).toBe("RESULTADO_INDETERMINADO");
    const status = await provider.getSubmissionStatus("k1", "t-a");
    expect(status?.status).toBe("AUTORIZADA");
    const again = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(again.status).toBe("AUTORIZADA");
    expect(transport.emitCalls).toBe(1); // a consulta antes do envio evitou o reenvio
  });

  it("E0014 (DPS já gerou nota) vira conciliação, não rejeição", async () => {
    const { provider, transport, allocator } = setup();
    const n = await allocator.numberFor("t-a", "k1");
    // Simula outra instância que já emitiu esta DPS sem o nosso registro de consulta.
    const dpsId = buildDpsId({ ...emitter, ...n });
    const { gzipSync } = await import("node:zlib");
    await transport.emit(
      gzipSync(Buffer.from(`<DPS><infDPS Id="${dpsId}"/></DPS>`)).toString(
        "base64",
      ),
      dpsId,
    );
    transport.dpsExists = async () => false; // consulta prévia "falha" e o envio recebe E0014
    const out = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(out.status).not.toBe("REJEITADA");
  });

  it("pedidos diferentes recebem números diferentes; o mesmo pedido mantém o número", async () => {
    const { allocator } = setup();
    const a = await allocator.numberFor("t-a", "k1");
    const b = await allocator.numberFor("t-a", "k2");
    expect(a.number).not.toBe(b.number);
    expect(await allocator.numberFor("t-a", "k1")).toEqual(a);
  });

  it("o corpo enviado é a DPS compactada", async () => {
    const { provider, transport } = setup();
    let body = "";
    const original = transport.emit.bind(transport);
    transport.emit = async (b, id) => {
      body = b;
      return original(b, id);
    };
    await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k9",
      draft,
    });
    expect(gunzipSync(Buffer.from(body, "base64")).toString("utf8")).toMatch(
      /^<DPS /,
    );
  });

  it("transporte oficial (mTLS) está bloqueado nesta fase", () => {
    expect(() => createMtlsSefinTransport()).toThrow(
      TransportNotAvailableError,
    );
  });
});

describe("fila + conector nacional simulado", () => {
  it("timeout é conciliado na mesma rodada e gera uma única nota", async () => {
    const { provider, transport } = setup();
    transport.failNextEmitWithTimeout = true;
    const job: QueueJob = {
      id: "r1",
      tenantId: "t-a",
      status: "AUTORIZADA_PARA_ENVIO",
      idempotencyKey: "k1",
      draft,
      attemptCount: 0,
    };
    let status: FiscalStatus = job.status;
    const repo: QueueRepo = {
      async claimDue() {
        return [{ ...job }];
      },
      async transition(_j, from, to) {
        if (status !== from) return false;
        if (from !== to && !canTransition(from, to)) throw new Error("salto");
        status = to;
        return true;
      },
      async recordAttempt() {},
      async hasAuthorizedAttempt() {
        return false;
      },
      async scheduleRetry() {},
    };
    await processQueue({
      moduleEnabled: true,
      repo,
      provider,
      now: new Date(),
    });
    expect(status).toBe("AUTORIZADA");
    expect(transport.emitCalls).toBe(1);
  });
});
