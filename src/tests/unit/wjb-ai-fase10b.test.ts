import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CertificateUseDeniedError,
  InMemoryCertificateUsageSink,
  TestCertificateVault,
  useCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-vault";
import {
  evaluateEmitterAuthorization,
  type AuthorizationRecord,
} from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import {
  CERTIFICATE_INCIDENT_DATE,
  CERTIFICATE_POLICY,
  createIcpBrasilTrustStore,
  createRevocationChecker,
  evaluateCertificatePolicy,
  fingerprintOf,
  SimulatedRevocationChecker,
  type TrustStore,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import { LAYOUT_CONTRACTS } from "@/lib/wjb-ai/fiscal/national/layouts";
import {
  OfficialSefinTransport,
  SEFIN_API_CONTRACT,
  SefinIndeterminateError,
  unconfirmedContractFields,
  type SefinHttpClient,
  type SefinHttpRequest,
  type SefinHttpResponse,
} from "@/lib/wjb-ai/fiscal/national/official-transport";
import {
  InMemoryDpsNumberAllocator,
  NationalNFSeProvider,
} from "@/lib/wjb-ai/fiscal/national/provider";
import { explainRejection } from "@/lib/wjb-ai/fiscal/national/rejection-catalog";
import { SimulatedDpsSigner } from "@/lib/wjb-ai/fiscal/national/signing";
import {
  currentGateState,
  evaluateTransmissionGate,
  requireOpenGate,
  TransmissionBlockedError,
  type GateState,
} from "@/lib/wjb-ai/fiscal/national/transmission-gate";
import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import {
  createTestPki,
  opensslAvailable,
  type TestPki,
} from "@/tests/helpers/test-pki";

// Tudo FICTÍCIO: CNPJs inventados, AC de teste gerada na hora, sem rede.
const WJB = "99888777000155";
const CLIENTE = "11222333000181";
const TODAY = new Date().toISOString().slice(0, 10);
const DPS_ID = `DPS${"3".repeat(42)}`;
// Chaves de acesso fictícias no formato de 50 dígitos.
const KEY_A = "1".repeat(50);
const KEY_B = "2".repeat(50);
const KEY_C = "3".repeat(50);
const WJB_REAL_CNPJ = "33152193000155"; // CNPJ público da WJB (siteConfig), em certificado FICTÍCIO

let pki: TestPki | null = null;
const trustOf = (p: TestPki): TrustStore => ({
  kind: "teste",
  anchors: [p.ca],
  intermediates: [],
});

beforeAll(() => {
  if (opensslAvailable) pki = createTestPki();
});
afterAll(() => pki?.dispose());

describe.skipIf(!opensslAvailable)("política de certificado (Fase 10B)", () => {
  const ok = async (
    opts: Parameters<TestPki["leaf"]>[1],
    role: "wjb" | "cliente" = "wjb",
    extra: Partial<Parameters<typeof evaluateCertificatePolicy>[0]> = {},
  ) =>
    evaluateCertificatePolicy({
      certificate: pki!.leaf(`c${Math.random().toString(36).slice(2)}`, opts)
        .x509,
      role,
      trust: trustOf(pki!),
      revocation: new SimulatedRevocationChecker(),
      ...extra,
    });
  const codes = (r: Awaited<ReturnType<typeof ok>>) =>
    r.ok ? [] : r.blockers.map((b) => b.code);

  it("e-CNPJ da WJB, reemitido depois do incidente, cadeia de teste e não revogado: aceito", async () => {
    const r = await ok({ cnpj: WJB });
    expect(codes(r)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("certificado da WJB emitido ANTES do incidente é recusado (protege o exposto e cópias)", async () => {
    const r = await ok({ cnpj: WJB, notBefore: "20261101000000Z", days: 400 });
    expect(codes(r)).toContain("CERT_ISSUED_BEFORE_INCIDENT");
    expect(CERTIFICATE_INCIDENT_DATE).toBe("2026-11-26");
  });

  it("o corte do incidente não atinge certificado de CLIENTE (modelo B)", async () => {
    const r = await ok(
      { cnpj: CLIENTE, notBefore: "20261101000000Z", days: 400 },
      "cliente",
    );
    expect(codes(r)).not.toContain("CERT_ISSUED_BEFORE_INCIDENT");
  });

  it("modelo A com e-CPF (pessoa física) é recusado: exige e-CNPJ", async () => {
    const r = await ok({ cpf: `0101199000000000191` });
    expect(codes(r)).toContain("WJB_CERT_NOT_ECNPJ");
  });

  it("impressão digital na lista de comprometidos é recusada", async () => {
    const leaf = pki!.leaf("comprometido", { cnpj: WJB });
    const r = await evaluateCertificatePolicy({
      certificate: leaf.x509,
      role: "wjb",
      trust: trustOf(pki!),
      revocation: new SimulatedRevocationChecker(),
      config: {
        ...CERTIFICATE_POLICY,
        compromisedFingerprints: [fingerprintOf(leaf.x509)],
      },
    });
    expect(codes(r)).toContain("CERT_COMPROMISED");
  });

  it("cadeia de outra AC (não confiável) é recusada", async () => {
    const r = await ok({ cnpj: WJB, issuer: "outra-ca" });
    expect(codes(r)).toContain("CERT_CHAIN_UNTRUSTED");
  });

  it("certificado vencido é recusado", async () => {
    const r = await ok(
      {
        cnpj: CLIENTE,
        notBefore: "20260101000000Z",
        notAfter: "20260201000000Z",
      },
      "cliente",
    );
    expect(codes(r)).toContain("CERT_OUT_OF_VALIDITY");
  });

  it("chave RSA de 1024 bits e assinatura SHA-1 do certificado são recusadas", async () => {
    const r = await ok({ cnpj: WJB, bits: 1024, digest: "sha1" });
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "CERT_KEY_UNSUPPORTED",
        "CERT_SIGNATURE_ALGORITHM",
      ]),
    );
  });

  it("revogado (simulado) e revogação desconhecida são recusados", async () => {
    const leaf = pki!.leaf("revogado", { cnpj: WJB });
    const rev = new SimulatedRevocationChecker();
    rev.revoked.add(fingerprintOf(leaf.x509));
    const base = {
      certificate: leaf.x509,
      role: "wjb" as const,
      trust: trustOf(pki!),
    };
    expect(
      codes(await evaluateCertificatePolicy({ ...base, revocation: rev })),
    ).toContain("CERT_REVOKED");
    const down = new SimulatedRevocationChecker();
    down.unavailable = true;
    expect(
      codes(await evaluateCertificatePolicy({ ...base, revocation: down })),
    ).toContain("CERT_REVOCATION_UNKNOWN");
  });

  it("sem repositório de confiança e sem verificador de revogação: falha fechada", async () => {
    const r = await ok({ cnpj: WJB }, "wjb", { trust: null, revocation: null });
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "CERT_CHAIN_UNVERIFIED",
        "CERT_REVOCATION_UNVERIFIED",
      ]),
    );
    expect(() => createIcpBrasilTrustStore()).toThrow(/não configurada/);
    expect(() => createRevocationChecker()).toThrow(/não configurada/);
  });

  it("entrada que não é certificado é recusada sem exceção", async () => {
    const r = await evaluateCertificatePolicy({
      certificate: Buffer.from("isto não é um certificado"),
      role: "wjb",
      trust: null,
      revocation: null,
    });
    expect(codes(r)).toEqual(["CERT_UNREADABLE"]);
  });

  it("impressão digital colada com dois-pontos e maiúsculas também bloqueia", async () => {
    const leaf = pki!.leaf("comprometido2", { cnpj: WJB });
    const pretty = leaf.x509.fingerprint256; // "AB:CD:..." como o openssl mostra
    const r = await evaluateCertificatePolicy({
      certificate: leaf.x509,
      role: "wjb",
      trust: trustOf(pki!),
      revocation: new SimulatedRevocationChecker(),
      config: { ...CERTIFICATE_POLICY, compromisedFingerprints: [pretty] },
    });
    expect(codes(r)).toContain("CERT_COMPROMISED");
  });

  it("impressão digital malformada na configuração derruba a avaliação (nunca desliga o bloqueio)", async () => {
    await expect(
      evaluateCertificatePolicy({
        certificate: pki!.leaf("x1", { cnpj: WJB }).x509,
        role: "wjb",
        trust: null,
        revocation: null,
        config: { ...CERTIFICATE_POLICY, compromisedFingerprints: ["abc"] },
      }),
    ).rejects.toThrow(/inválida/);
  });

  it("certificado da WJB cadastrado como de CLIENTE também cai na regra do incidente", async () => {
    const r = await ok(
      { cnpj: WJB_REAL_CNPJ, notBefore: "20261101000000Z", days: 400 },
      "cliente",
    );
    expect(codes(r)).toContain("CERT_ISSUED_BEFORE_INCIDENT");
  });

  it("certificado de AC ou sem Autenticação de Cliente não serve como certificado final", async () => {
    expect(codes(await ok({ cnpj: WJB, ca: true }))).toContain(
      "CERT_LEAF_IS_CA",
    );
    expect(codes(await ok({ cnpj: WJB, noClientAuth: true }))).toContain(
      "CERT_LEAF_USAGE",
    );
  });

  it("useCertificate: certificado recusado pela política é negado e auditado sem dados pessoais", async () => {
    const leaf = pki!.leaf("antigo", {
      cnpj: WJB,
      notBefore: "20261101000000Z",
      days: 400,
    });
    const meta = inspectCertificate(leaf.pem, "vault://teste/wjb");
    const vault = new TestCertificateVault();
    vault.put("vault://teste/wjb", leaf.material);
    const audit = new InMemoryCertificateUsageSink();
    const grant: AuthorizationRecord = {
      id: "g-a",
      kind: "procuracao",
      emissionModel: "wjb_procuracao",
      status: "active",
      scope: "Emissão de NFS-e",
      validUntil: "2027-11-20",
      revokedAt: null,
      holderDocument: WJB,
      certificate: null,
    };
    let called = false;
    await expect(
      useCertificate(
        {
          tenantId: "t-a",
          requestId: "r1",
          purpose: "assinatura",
          environment: "simulado",
        },
        {
          authorize: async () =>
            evaluateEmitterAuthorization({
              tenantDocument: CLIENTE,
              grants: [grant],
              wjbCertificate: meta,
              today: TODAY,
            }),
          vault,
          audit,
          trust: trustOf(pki!),
          revocation: new SimulatedRevocationChecker(),
          lifecycle: {
            state: async () => ({ registered: true, status: "ativo" as const, blocked: false, role: "wjb" as const, tenantId: null }),
          },
        },
        async () => {
          called = true;
          return "x";
        },
      ),
    ).rejects.toThrow(CertificateUseDeniedError);
    expect(called).toBe(false);
    expect(audit.entries[0]).toMatchObject({ outcome: "negado" });
    expect(audit.entries[0].reason).toContain("CERT_ISSUED_BEFORE_INCIDENT");
    const dump = JSON.stringify(audit.entries);
    // nenhum CPF/CNPJ completo (a impressão digital é hexadecimal e pública)
    for (const doc of [WJB, CLIENTE]) expect(dump).not.toContain(doc);
    expect(dump).not.toMatch(/PRIVATE|BEGIN|MII/);
  });
});

// ------------------------------------------------- transporte oficial

class FakeSefinClient implements SefinHttpClient {
  readonly kind = "falso-teste" as const;
  requests: SefinHttpRequest[] = [];
  constructor(
    private readonly handler: (
      r: SefinHttpRequest,
    ) => SefinHttpResponse | Error,
  ) {}
  async send(r: SefinHttpRequest) {
    this.requests.push(r);
    const out = this.handler(r);
    if (out instanceof Error) throw out;
    return out;
  }
}

const ctx = { certificateHolderDocument: WJB };
const json = (status: number, body: unknown): SefinHttpResponse => ({
  status,
  body: JSON.stringify(body),
});
const C = SEFIN_API_CONTRACT;

describe("transporte oficial com cliente falso (testes de contrato, sem rede)", () => {
  it("o contrato tem campos não confirmados e diz quais", () => {
    expect(unconfirmedContractFields()).toEqual(
      expect.arrayContaining(["requestDpsField", "responseErrorsField"]),
    );
  });

  it("recusa host fora da produção restrita (produção e outros)", () => {
    const c = new FakeSefinClient(() => json(200, {}));
    expect(
      () =>
        new OfficialSefinTransport(c, {
          baseUrl: "https://sefin.nfse.gov.br/SefinNacional",
        }),
    ).toThrow(/Só produção restrita/);
    expect(
      () =>
        new OfficialSefinTransport(c, {
          baseUrl: "http://sefin.producaorestrita.nfse.gov.br/x",
        }),
    ).toThrow(/HTTPS/);
    expect(
      () => new OfficialSefinTransport(c, { baseUrl: "https://exemplo.com/x" }),
    ).toThrow(/Host não permitido/);
  });

  it("emissão: monta POST /nfse com a DPS no campo do contrato", async () => {
    const c = new FakeSefinClient(() =>
      json(201, { [C.responseAccessKeyField.name]: KEY_A }),
    );
    const t = new OfficialSefinTransport(c);
    const r = await t.emit("ZGFkb3M=", DPS_ID, ctx);
    expect(r).toEqual({
      kind: "authorized",
      accessKey: KEY_A,
      nfseXml: undefined,
    });
    expect(c.requests[0].method).toBe("POST");
    expect(c.requests[0].url.toString()).toBe(
      "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse",
    );
    expect(JSON.parse(c.requests[0].body!)).toEqual({
      [C.requestDpsField.name]: "ZGFkb3M=",
    });
  });

  it("rejeição com lista de erros vira 'rejected'", async () => {
    const t = new OfficialSefinTransport(
      new FakeSefinClient(() =>
        json(400, {
          [C.responseErrorsField.name]: [
            {
              [C.errorCodeField.name]: "E0010",
              [C.errorMessageField.name]: "Série fora da faixa",
            },
          ],
        }),
      ),
    );
    expect(await t.emit("x", DPS_ID, ctx)).toEqual({
      kind: "rejected",
      errors: [{ code: "E0010", message: "Série fora da faixa" }],
    });
  });

  it.each([
    ["5xx", json(503, { erro: "indisponível" })],
    ["4xx sem lista de erros", json(400, { mensagem: "algo" })],
    ["2xx sem chave", json(200, {})],
    ["corpo não JSON", { status: 200, body: "<html>" }],
  ])("%s nunca vira rejeição: resultado indeterminado", async (_n, res) => {
    const t = new OfficialSefinTransport(new FakeSefinClient(() => res));
    await expect(t.emit("x", DPS_ID, ctx)).rejects.toBeInstanceOf(
      SefinIndeterminateError,
    );
  });

  it.each([
    [
      "409 com lista de erros",
      json(409, { erros: [{ Codigo: "E0014", Descricao: "x" }] }),
    ],
    [
      "429 com lista de erros",
      json(429, { erros: [{ Codigo: "E0010", Descricao: "x" }] }),
    ],
    [
      "400 com código fora do padrão oficial",
      json(400, { erros: [{ Codigo: "PROXY-1", Descricao: "x" }] }),
    ],
    [
      "2xx com chave fora do formato",
      json(201, { chaveAcesso: "CHAVE-QUALQUER" }),
    ],
  ])("%s: indeterminado, nunca rejeição nem autorização", async (_n, res) => {
    const t = new OfficialSefinTransport(new FakeSefinClient(() => res));
    await expect(t.emit("x", DPS_ID, ctx)).rejects.toBeInstanceOf(
      SefinIndeterminateError,
    );
  });

  it("mensagem de rejeição com CPF/CNPJ do tomador é mascarada", async () => {
    const t = new OfficialSefinTransport(
      new FakeSefinClient(() =>
        json(400, {
          [C.responseErrorsField.name]: [
            {
              [C.errorCodeField.name]: "E0200",
              [C.errorMessageField.name]: "Tomador 11222333000181 inválido",
            },
          ],
        }),
      ),
    );
    const r = await t.emit("x", DPS_ID, ctx);
    expect(JSON.stringify(r)).not.toMatch(/11222333000181/);
  });

  it("URL com porta ou credencial é recusada; cliente real sem portão aberto é recusado", () => {
    const fake = new FakeSefinClient(() => json(200, {}));
    expect(
      () =>
        new OfficialSefinTransport(fake, {
          baseUrl: "https://sefin.producaorestrita.nfse.gov.br:8443/x",
        }),
    ).toThrow(/porta/);
    expect(
      () =>
        new OfficialSefinTransport(fake, {
          baseUrl: "https://u:p@sefin.producaorestrita.nfse.gov.br/x",
        }),
    ).toThrow(/porta, usuário ou senha/);
    const real: SefinHttpClient = {
      kind: "mtls",
      send: async () => json(200, {}),
    };
    expect(() => new OfficialSefinTransport(real)).toThrow(/portão/);
    expect(
      () => new OfficialSefinTransport(real, { gate: { falso: true } }),
    ).toThrow(/portão/);
  });

  it("HEAD /dps: 200 existe, 404 não existe, outro status é indeterminado", async () => {
    const statuses = [200, 404, 500];
    const t = new OfficialSefinTransport(
      new FakeSefinClient(() => ({ status: statuses.shift()!, body: "" })),
    );
    expect(await t.dpsExists(DPS_ID)).toBe(true);
    expect(await t.dpsExists(DPS_ID)).toBe(false);
    await expect(t.dpsExists(DPS_ID)).rejects.toBeInstanceOf(
      SefinIndeterminateError,
    );
  });

  it("GET /dps: 403 (não é ator) devolve null para conciliação", async () => {
    const t = new OfficialSefinTransport(
      new FakeSefinClient(() => json(403, {})),
    );
    expect(await t.accessKeyForDps(DPS_ID)).toBeNull();
  });

  it("id de DPS malformado é recusado antes de qualquer requisição", async () => {
    const c = new FakeSefinClient(() => json(200, {}));
    const t = new OfficialSefinTransport(c);
    await expect(t.dpsExists("DPS123")).rejects.toThrow(/inválido/);
    expect(c.requests).toHaveLength(0);
  });
});

// ---------------------------------------- conector + transporte oficial

const draft: NormalizedNfseDraft = {
  serviceDescription: "Consultoria fictícia de teste",
  // Fase 10C: indDest declarado (destinatário = tomador); nunca presumido.
  recipientIsTaker: true,
  amountCents: 150000,
  competence: "2026-11",
  taker: {
    documentKind: "CNPJ",
    document: CLIENTE,
    name: "Tomador Fictício Ltda",
    email: null,
  },
} as unknown as NormalizedNfseDraft;

function connector(client: SefinHttpClient) {
  return new NationalNFSeProvider({
    transport: new OfficialSefinTransport(client),
    allocator: new InMemoryDpsNumberAllocator(1),
    signer: new SimulatedDpsSigner(),
    emitterFor: async () => ({
      municipalityIbge: "3550308",
      documentKind: "CNPJ",
      document: "55666777000191",
    }),
    parametersFor: async () => ({
      opSimpNac: "1",
      regEspTrib: "0",
      cLocPrestacao: "3550308",
      cTribNac: "010101",
      tribISSQN: "1",
      tpRetISSQN: "1",
      indTotTrib: "0",
    }),
    signerContextFor: async () => ctx,
  });
}

describe("conector nacional com transporte oficial falso", () => {
  it("resposta perdida (timeout) = indeterminado; a consulta seguinte concilia sem reenviar", async () => {
    let emitted = 0;
    let generated = false;
    const client = new FakeSefinClient((r) => {
      if (r.method === "POST") {
        emitted++;
        generated = true;
        return new Error("timeout");
      }
      if (r.method === "HEAD")
        return { status: generated ? 200 : 404, body: "" };
      return json(200, { [C.responseAccessKeyField.name]: KEY_B });
    });
    const p = connector(client);
    const first = await p.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(first.status).toBe("RESULTADO_INDETERMINADO");
    const again = await p.submitAuthorizedDocument({
      tenantId: "t-a",
      idempotencyKey: "k1",
      draft,
    });
    expect(again).toMatchObject({
      status: "AUTORIZADA",
      officialId: KEY_B,
    });
    expect(emitted).toBe(1);
  });

  it("dois envios simultâneos do mesmo pedido usam o MESMO número de DPS (sem nota duplicada)", async () => {
    const bodies: string[] = [];
    let n = 0;
    const client = new FakeSefinClient((r) => {
      if (r.method === "HEAD") return { status: n > 0 ? 200 : 404, body: "" };
      if (r.method === "GET")
        return json(200, { [C.responseAccessKeyField.name]: KEY_C });
      bodies.push(r.body!);
      n++;
      return n === 1
        ? json(201, { [C.responseAccessKeyField.name]: KEY_C })
        : json(400, {
            [C.responseErrorsField.name]: [
              {
                [C.errorCodeField.name]: "E0014",
                [C.errorMessageField.name]: "DPS já gerou NFS-e",
              },
            ],
          });
    });
    const p = connector(client);
    const [a, b] = await Promise.all([
      p.submitAuthorizedDocument({
        tenantId: "t-a",
        idempotencyKey: "k9",
        draft,
      }),
      p.submitAuthorizedDocument({
        tenantId: "t-a",
        idempotencyKey: "k9",
        draft,
      }),
    ]);
    expect(a).toMatchObject({
      status: "AUTORIZADA",
      officialId: KEY_C,
    });
    expect(b).toMatchObject({
      status: "AUTORIZADA",
      officialId: KEY_C,
    });
    // os dois envios carregam a MESMA DPS (mesmo Id = mesma série/número):
    // o segundo recebeu E0014 e foi conciliado, nunca renumerado.
    const ids = bodies.map((b) => {
      const xml = gunzipSync(
        Buffer.from(JSON.parse(b)[C.requestDpsField.name], "base64"),
      ).toString("utf8");
      return xml.match(/<infDPS Id="([^"]+)"/)?.[1];
    });
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ids).size).toBe(1);
    expect(a.simulated).toBe(true); // assinatura simulada: nunca nota real
  });
});

// ------------------------------------------------------------- portão

const allOpen: GateState = {
  environment: "producao_restrita",
  switchOn: true,
  productionAllowed: false,
  unconfirmedContractFields: [],
  signatureAlgorithmConfirmed: true,
  vaultConfigured: true,
  trustStoreConfigured: true,
  revocationConfigured: true,
};

describe("portão único de transmissão oficial", () => {
  it("o estado REAL desta fase está bloqueado em todas as condições", () => {
    const d = evaluateTransmissionGate(currentGateState("producao_restrita"));
    expect(d.open).toBe(false);
    if (!d.open)
      expect(d.blockers.map((b) => b.code)).toEqual(
        expect.arrayContaining([
          "GATE_SWITCH_OFF",
          "GATE_CONTRACT_UNCONFIRMED",
          "GATE_SIGNATURE_ALGORITHM_UNCONFIRMED",
          "GATE_VAULT_NOT_CONFIGURED",
          "GATE_TRUST_STORE_NOT_CONFIGURED",
          "GATE_REVOCATION_NOT_CONFIGURED",
        ]),
      );
  });

  it("ligar só o interruptor não abre nada", () => {
    const prev = process.env["WJB_AI_OFFICIAL_TRANSMISSION_ENABLED"];
    process.env["WJB_AI_OFFICIAL_TRANSMISSION_ENABLED"] = "true";
    try {
      const d = evaluateTransmissionGate(currentGateState("producao_restrita"));
      expect(d.open).toBe(false);
      if (!d.open)
        expect(d.blockers.map((b) => b.code)).not.toContain("GATE_SWITCH_OFF");
    } finally {
      if (prev === undefined)
        delete process.env["WJB_AI_OFFICIAL_TRANSMISSION_ENABLED"];
      else process.env["WJB_AI_OFFICIAL_TRANSMISSION_ENABLED"] = prev;
    }
  });

  it("cada condição isolada bloqueia; produção bloqueia mesmo com todo o resto", () => {
    expect(evaluateTransmissionGate(allOpen).open).toBe(true);
    for (const [k, v] of Object.entries({
      switchOn: false,
      signatureAlgorithmConfirmed: false,
      vaultConfigured: false,
      trustStoreConfigured: false,
      revocationConfigured: false,
      unconfirmedContractFields: ["x"],
    }))
      expect(evaluateTransmissionGate({ ...allOpen, [k]: v }).open).toBe(false);
    expect(
      evaluateTransmissionGate({ ...allOpen, environment: "producao" }).open,
    ).toBe(false);
  });

  it("bloqueio é auditado só com códigos; falha da auditoria não libera", async () => {
    const entries: unknown[] = [];
    await expect(
      requireOpenGate(
        currentGateState("producao_restrita"),
        { blocked: async (e) => void entries.push(e) },
        "teste",
      ),
    ).rejects.toBeInstanceOf(TransmissionBlockedError);
    expect(JSON.stringify(entries)).not.toMatch(/\d{11}|vault:\/\//);
    await expect(
      requireOpenGate(
        currentGateState("producao_restrita"),
        {
          blocked: async () => {
            throw new Error("auditoria fora");
          },
        },
        "teste",
      ),
    ).rejects.toBeInstanceOf(TransmissionBlockedError);
  });
});

// ------------------------------------------------- leiaute e catálogo

describe("NT 009 release 2 (24/11/2026)", () => {
  it("vigente em produção restrita e SEM data em produção (só 'prevista')", () => {
    const r2 = LAYOUT_CONTRACTS.find(
      (l) => l.id === "producao-restrita-nt009-r2-20261124",
    )!;
    expect(r2.validFrom).toEqual({
      producao_restrita: "2026-11-24",
      producao: null,
    });
    expect(r2.rules.indDestInInfDps).toBe(true);
  });

  it("catálogo do Anexo I de 24/11: E0718 já cita representação concedida pelo emitente", () => {
    const e = explainRejection("E0718", "producao-restrita-nt009-r2-20261124");
    expect(e.official).toBe(true);
    expect(e.message).toMatch(/representação concedida pelo emitente/);
  });
});

// ------------------------------- nenhum caminho aceita certificado do usuário

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe("nenhuma rota, ação ou tela recebe arquivo de certificado", () => {
  it("app, actions e componentes não aceitam PFX/P12/chave privada", () => {
    const roots = ["src/app", "src/actions", "src/components"].map((r) =>
      path.join(process.cwd(), r),
    );
    const hits = roots
      .flatMap(filesUnder)
      .filter((f) => /\.(tsx?|mjs|js)$/.test(f))
      .filter((f) =>
        /\.pfx|\.p12|pkcs12|application\/x-pkcs12|BEGIN PRIVATE KEY|createPrivateKey/i.test(
          readFileSync(f, "utf8"),
        ),
      );
    expect(hits).toEqual([]);
  });
});
