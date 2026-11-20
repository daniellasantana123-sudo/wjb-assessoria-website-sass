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
import {
  LAYOUT_CONTRACTS,
  resolveLayout,
} from "@/lib/wjb-ai/fiscal/national/layouts";
import { SimulatedDpsSigner } from "@/lib/wjb-ai/fiscal/national/signing";
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

const PROD = resolveLayout("producao", "2026-11-20");
const WJB_CNPJ = "99888777000155"; // fictício

function setup(opts: { holder?: string } = {}) {
  const transport = new SimulatedSefinTransport();
  const allocator = new InMemoryDpsNumberAllocator(1);
  const provider = new NationalNFSeProvider({
    transport,
    allocator,
    signer: new SimulatedDpsSigner(),
    emitterFor: async () => emitter,
    parametersFor: async () => params,
    signerContextFor: async () => ({
      certificateHolderDocument: opts.holder ?? emitter.document,
    }),
    now: () => new Date("2026-11-20T12:00:00-03:00"),
  });
  return { transport, allocator, provider };
}
const ctxEmitter = { certificateHolderDocument: emitter.document };

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
    layout: PROD,
    environment: "producao_restrita" as const,
    series: 1,
    number: 1,
    issuedAt: new Date("2026-11-20T12:00:00-03:00"),
    emitter,
    draft,
  };
  it("usa os grupos oficiais e tpAmb 2 (produção restrita)", () => {
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
    ).toThrow(/domínio oficial/);
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
    const signed = await new SimulatedDpsSigner().sign(
      buildDpsXml({
        dpsId,
        layout: PROD,
        environment: "producao_restrita",
        ...n,
        issuedAt: new Date(),
        emitter,
        draft,
        params,
      }),
      dpsId,
    );
    await transport.emit(
      gzipSync(Buffer.from(signed)).toString("base64"),
      dpsId,
      ctxEmitter,
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
    transport.emit = async (b, id, c) => {
      body = b;
      return original(b, id, c);
    };
    await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k9",
      draft,
    });
    expect(gunzipSync(Buffer.from(body, "base64")).toString("utf8")).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?><DPS /,
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

describe("Fase 5: assinatura, procuração e regras oficiais no conector simulado", () => {
  it("DPS sai assinada (enveloped, logo depois de infDPS) e a assinatura detecta adulteração", async () => {
    const xml = buildDpsXml({
      dpsId: buildDpsId({ ...emitter, series: 1, number: 7 }),
      layout: PROD,
      environment: "producao_restrita",
      series: 1,
      number: 7,
      issuedAt: new Date("2026-11-20T12:00:00-03:00"),
      emitter,
      draft,
      params,
    });
    const signed = await new SimulatedDpsSigner().sign(
      xml,
      buildDpsId({ ...emitter, series: 1, number: 7 }),
    );
    expect(signed).toMatch(
      /<\/infDPS><Signature xmlns="http:\/\/www.w3.org\/2000\/09\/xmldsig#">/,
    );
    expect(signed).toContain('<Reference URI="#DPS');
    expect(SimulatedDpsSigner.verify(signed)).toBe(true);
    expect(SimulatedDpsSigner.verify(signed.replace("250.00", "2500.00"))).toBe(
      false,
    );
    expect(
      Buffer.from(
        signed.match(/<SignatureValue>([^<]+)/)![1],
        "base64",
      ).toString(),
    ).toMatch(/^SIMULADO:/);
  });

  it("modelo A sem procuração na RFB: E0718 (rejeitada, sem nota)", async () => {
    const { provider } = setup({ holder: WJB_CNPJ });
    const out = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "kA",
      draft,
    });
    expect(out).toMatchObject({ status: "REJEITADA", rejectionCode: "E0718" });
  });

  it("modelo A com procuração: autorizada; consulta GET sem tratar procurador como ator fica INDETERMINADA, nunca reenvia", async () => {
    const { provider, transport } = setup({ holder: WJB_CNPJ });
    transport.procuracoes.add(`${emitter.document}>${WJB_CNPJ}`);
    transport.failNextEmitWithTimeout = true;
    const first = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "kA",
      draft,
    });
    expect(first.status).toBe("RESULTADO_INDETERMINADO");
    // HEAD diz que existe; GET nega a chave ao procurador (regra não confirmada).
    expect((await provider.getSubmissionStatus("kA", "t-a"))?.status).toBe(
      "RESULTADO_INDETERMINADO",
    );
    const again = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "kA",
      draft,
    });
    expect(again.status).toBe("RESULTADO_INDETERMINADO");
    expect(transport.emitCalls).toBe(1);
    transport.procuradorIsActor = true;
    expect((await provider.getSubmissionStatus("kA", "t-a"))?.status).toBe(
      "AUTORIZADA",
    );
  });

  it("procuração revogada na RFB depois do cadastro: E0718 na próxima emissão", async () => {
    const { provider, transport } = setup({ holder: WJB_CNPJ });
    transport.procuracoes.add(`${emitter.document}>${WJB_CNPJ}`);
    expect(
      (
        await provider.submitAuthorizedDocument({
          tenantId: "t-a",
          idempotencyKey: "k1",
          draft,
        })
      ).status,
    ).toBe("AUTORIZADA");
    transport.procuracoes.clear();
    const out = await provider.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k2",
      draft,
    });
    expect(out).toMatchObject({ status: "REJEITADA", rejectionCode: "E0718" });
  });

  it("série fora da faixa do canal API é recusada antes de enviar (E0010 evitado)", async () => {
    const transport = new SimulatedSefinTransport();
    const provider = new NationalNFSeProvider({
      transport,
      allocator: new InMemoryDpsNumberAllocator(70000),
      signer: new SimulatedDpsSigner(),
      emitterFor: async () => emitter,
      parametersFor: async () => params,
      signerContextFor: async () => ctxEmitter,
      now: () => new Date("2026-11-20T12:00:00-03:00"),
    });
    await expect(
      provider.submitAuthorizedDocument({
        tenantId: "t-a",
        idempotencyKey: "k1",
        draft,
      }),
    ).rejects.toThrow(/faixa do canal API/);
    expect(transport.emitCalls).toBe(0);
  });

  it("DPS sem assinatura é rejeitada pelo simulador (E0717)", async () => {
    const transport = new SimulatedSefinTransport();
    const dpsId = buildDpsId({ ...emitter, series: 1, number: 1 });
    const xml = buildDpsXml({
      dpsId,
      layout: PROD,
      environment: "producao_restrita",
      series: 1,
      number: 1,
      issuedAt: new Date(),
      emitter,
      draft,
      params,
    });
    const { gzipSync } = await import("node:zlib");
    const out = await transport.emit(
      gzipSync(Buffer.from(xml)).toString("base64"),
      dpsId,
      ctxEmitter,
    );
    expect(out.errors?.[0]?.code).toBe("E0717");
  });

  it("CNPJ alfanumérico: recusado no leiaute de produção, aceito no de produção restrita (NT 009)", () => {
    const restrita = resolveLayout("producao_restrita", "2026-11-20");
    const alnum = {
      ...emitter,
      document: "12ABC34501DE35",
      series: 1,
      number: 1,
    };
    expect(() => buildDpsId(alnum, PROD)).toThrow(/alfanumérico/);
    expect(buildDpsId(alnum, restrita)).toMatch(/^DPS3550308212ABC34501DE35/);
  });
});

describe("versionamento dos leiautes por ambiente e vigência", () => {
  it("produção usa o pacote v1.01 de 09/02/2026; NT 009 não vale em produção sem data oficial", () => {
    expect(resolveLayout("producao", "2026-11-20").id).toBe(
      "producao-v1.01-20260209",
    );
    expect(resolveLayout("producao", "2027-06-01").id).toBe(
      "producao-v1.01-20260209",
    );
  });
  it("produção restrita usa a NT 009 só a partir de 20/10/2026", () => {
    expect(resolveLayout("producao_restrita", "2026-10-19").id).toBe(
      "producao-v1.01-20260209",
    );
    expect(resolveLayout("producao_restrita", "2026-10-20").id).toBe(
      "producao-restrita-nt009-r1-20261020",
    );
  });
  it("uma vigência futura publicada só é aplicada a partir da data", () => {
    const future = LAYOUT_CONTRACTS.map((c) =>
      c.id === "producao-restrita-nt009-r1-20261020"
        ? { ...c, validFrom: { ...c.validFrom, producao: "2026-12-01" } }
        : c,
    );
    expect(resolveLayout("producao", "2026-11-30", future).id).toBe(
      "producao-v1.01-20260209",
    );
    expect(resolveLayout("producao", "2026-12-01", future).id).toBe(
      "producao-restrita-nt009-r1-20261020",
    );
  });
  it("sem leiaute vigente, recusa", () => {
    expect(() => resolveLayout("producao", "2026-01-01")).toThrow(
      /Nenhum leiaute/,
    );
  });
});
