import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InMemoryAgentAuditSink,
  explainRejectionHandler,
  runTool,
  type AgentContext,
} from "@/lib/wjb-ai/agents/runtime";
import {
  aliquotaRule,
  checkRegimeAndAliquota,
  type RegimeInput,
} from "@/lib/wjb-ai/fiscal/aliquota-rules";
import {
  CertificateUseDeniedError,
  createCertificateVault,
  CertificateVaultNotConfiguredError,
  InMemoryCertificateUsageSink,
  TestCertificateVault,
  useCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-vault";
import {
  evaluateEmitterAuthorization,
  type AuthorizationRecord,
} from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { evaluateFiscalAlerts } from "@/lib/wjb-ai/fiscal/monitoring";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import { buildDpsId } from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import { LAYOUT_CONTRACTS } from "@/lib/wjb-ai/fiscal/national/layouts";
import {
  InMemoryDpsNumberAllocator,
  NationalNFSeProvider,
} from "@/lib/wjb-ai/fiscal/national/provider";
import {
  catalogSize,
  explainRejection,
} from "@/lib/wjb-ai/fiscal/national/rejection-catalog";
import {
  AlgorithmNotConfirmedError,
  XmlDsigDpsSigner,
} from "@/lib/wjb-ai/fiscal/national/signing";
import { SimulatedSefinTransport } from "@/lib/wjb-ai/fiscal/national/simulated-transport";
import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";
import { SimulatedRevocationChecker } from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import { createTestPki, type TestPki } from "@/tests/helpers/test-pki";

// Tudo FICTÍCIO. Certificados de TESTE gerados na hora, não ICP-Brasil.
// "Hoje" na MESMA referência dos certificados de teste (UTC), gerados agora:
// com a data de Brasília, entre 21h e 0h o certificado parecia "ainda não
// válido" (CERT_NOT_YET_VALID). Corrigido na Fase 10A.1.
const TODAY = new Date().toISOString().slice(0, 10);
const WJB = "99888777000155";
const CLIENTE = "11222333000181";
const tools =
  spawnSync("openssl", ["version"], { stdio: "ignore" }).status === 0 &&
  spawnSync("xmllint", ["--version"], { stdio: "ignore" }).status === 0;

let dir = "";
const material: Record<string, SigningMaterial> = {};
const pem: Record<string, string> = {};

let pki: TestPki | null = null;
function makeCert(name: string, cnpj: string) {
  const leaf = pki!.leaf(name, { cnpj });
  pem[name] = leaf.pem;
  material[name] = leaf.material;
}

beforeAll(() => {
  if (!tools) return;
  pki = createTestPki();
  dir = pki.dir;
  makeCert("wjb", WJB);
  makeCert("cliente", CLIENTE);
  makeCert("intruso", WJB); // mesmo CNPJ, outro par de chaves
});
afterAll(() => {
  pki?.dispose();
});

/** Política com a AC de teste como raiz e revogação simulada (Fase 10B). */
const policyDeps = () => ({
  trust: { kind: "teste" as const, anchors: [pki!.ca], intermediates: [] },
  revocation: new SimulatedRevocationChecker(),
  today: TODAY,
});

const base: RegimeInput = {
  opSimpNac: "3",
  regApTribSN: "1",
  regEspTrib: "0",
  tribISSQN: "1",
  tpRetISSQN: "1",
  convenioMunicipioAtivo: true,
};

describe("regras oficiais de alíquota e regime (Anexo I, regras 226, 230, 501-513)", () => {
  const cases: [Partial<RegimeInput>, "proibida" | "obrigatoria", string][] = [
    [{ tribISSQN: "2" }, "proibida", "E0602"],
    [{ opSimpNac: "2", regApTribSN: null }, "proibida", "E0600"],
    [{ regEspTrib: "5", regApTribSN: "2" }, "proibida", "E0604"],
    [
      { opSimpNac: "1", regApTribSN: null, convenioMunicipioAtivo: true },
      "proibida",
      "E0617",
    ],
    [
      { opSimpNac: "1", regApTribSN: null, convenioMunicipioAtivo: false },
      "obrigatoria",
      "E0619",
    ],
    [{ tpRetISSQN: "2", convenioMunicipioAtivo: true }, "obrigatoria", "E0621"],
    [{ tpRetISSQN: "1", convenioMunicipioAtivo: true }, "proibida", "E0625"],
    [
      { tpRetISSQN: "3", convenioMunicipioAtivo: false },
      "obrigatoria",
      "E0628",
    ],
    [{ tpRetISSQN: "1", convenioMunicipioAtivo: false }, "proibida", "E0631"],
    [{ regApTribSN: "2", convenioMunicipioAtivo: true }, "proibida", "E0635"],
    [
      { regApTribSN: "3", convenioMunicipioAtivo: false },
      "obrigatoria",
      "E0640",
    ],
  ];
  for (const [over, mode, code] of cases) {
    it(`${code}: alíquota ${mode}`, () => {
      expect(aliquotaRule({ ...base, ...over })).toMatchObject({ mode, code });
    });
  }
  it("mínimo de 1,80% quando ME/EPP pelo SN tem ISSQN retido; máximo de 5% (E0595)", () => {
    const i = { ...base, tpRetISSQN: "2" };
    expect(checkRegimeAndAliquota(i, 1.5)[0].code).toBe("E0621");
    expect(checkRegimeAndAliquota(i, 6)[0].code).toBe("E0595");
    expect(checkRegimeAndAliquota(i, 2)).toEqual([]);
  });
  it("regApTribSN só para ME/EPP (E0162) e regime especial 0 quando pelo SN (E0175)", () => {
    expect(
      checkRegimeAndAliquota({ ...base, opSimpNac: "1" }, null)[0].code,
    ).toBe("E0162");
    expect(
      checkRegimeAndAliquota({ ...base, regEspTrib: "3" }, null)[0].code,
    ).toBe("E0175");
  });
  it("alíquota informada quando proibida é recusada", () => {
    expect(checkRegimeAndAliquota(base, 2)[0].code).toBe("E0625");
  });
});

describe("catálogo oficial de rejeições", () => {
  it("tem os códigos dos dois leiautes, com a mensagem oficial", () => {
    expect(catalogSize("producao-v1.01-20260209")).toBeGreaterThan(400);
    expect(catalogSize("producao-restrita-nt009-r1-20261020")).toBeGreaterThan(
      400,
    );
    const e = explainRejection("E0718", "producao-v1.01-20260209");
    expect(e).toMatchObject({ official: true, category: "autorizacao" });
    expect(e.message).toMatch(/certificado digital do emitente/);
  });
  it("código fora do catálogo nunca ganha explicação inventada", () => {
    expect(explainRejection("E9999", "producao-v1.01-20260209")).toMatchObject({
      official: false,
      message: "Código não consta no catálogo oficial deste leiaute.",
    });
  });
  it("E0014 é duplicidade (concilia) e E1203 é certificado", () => {
    expect(explainRejection("E0014", "producao-v1.01-20260209").category).toBe(
      "duplicidade",
    );
    expect(explainRejection("E1203", "producao-v1.01-20260209").category).toBe(
      "certificado",
    );
  });
  it("agente de Supervisão consulta o catálogo pela ferramenta autorizada; Fiscal não pode", async () => {
    const ctx = {
      traceId: "t1",
      tenant: { id: "t-a" },
    } as unknown as AgentContext;
    const sink = new InMemoryAgentAuditSink();
    const ok = await runTool(
      "supervisao",
      "explain_rejection",
      { code: "E0010", layoutId: "producao-v1.01-20260209" },
      ctx,
      { explain_rejection: explainRejectionHandler },
      sink,
    );
    expect(ok.ok && (ok.output as { official: boolean }).official).toBe(true);
    const denied = await runTool(
      "fiscal",
      "explain_rejection",
      { code: "E0010", layoutId: "x" },
      ctx,
      { explain_rejection: explainRejectionHandler },
      sink,
    );
    expect(denied.ok).toBe(false);
  });
});

describe("monitoramento e alertas", () => {
  const now = new Date("2026-11-20T15:00:00-03:00");
  it("certificado e procuração vencidos ou vencendo, resultado desconhecido parado, fila de erros e rejeição de certificado", () => {
    const alerts = evaluateFiscalAlerts({
      now,
      grants: [
        {
          id: "g1",
          tenantId: "t1",
          kind: "procuracao",
          validUntil: "2026-11-19",
          revokedAt: null,
          certificateValidUntil: null,
        },
        {
          id: "g2",
          tenantId: "t2",
          kind: "procuracao",
          validUntil: "2026-12-05",
          revokedAt: null,
          certificateValidUntil: null,
        },
        {
          id: "g3",
          tenantId: "t3",
          kind: "certificado_proprio",
          validUntil: "2027-11-20",
          revokedAt: null,
          certificateValidUntil: "2026-12-01",
        },
        {
          id: "g4",
          tenantId: "t4",
          kind: "procuracao",
          validUntil: "2026-11-01",
          revokedAt: "2026-11-02T00:00:00Z",
          certificateValidUntil: null,
        },
      ],
      requests: [
        {
          id: "r1",
          tenantId: "t1",
          status: "RESULTADO_INDETERMINADO",
          updatedAt: "2026-11-20T17:00:00Z",
          needsIntervention: false,
          lastError: null,
        },
        {
          id: "r2",
          tenantId: "t1",
          status: "CONCILIACAO_OFICIAL",
          updatedAt: "2026-11-20T17:55:00Z",
          needsIntervention: false,
          lastError: null,
        },
        {
          id: "r3",
          tenantId: "t2",
          status: "REJEITADA",
          updatedAt: "2026-11-20T17:00:00Z",
          needsIntervention: true,
          lastError: "E1203 certificado expirado",
        },
      ],
      usageDenied24h: [{ tenantId: "t1", reason: "GRANT_REVOKED" }],
    });
    const codes = alerts.map((a) => a.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "PROCURACAO_EXPIRED",
        "PROCURACAO_EXPIRING",
        "CERT_EXPIRING",
        "RESULTADO_INDETERMINADO_PARADO",
        "FILA_DE_ERROS",
        "REJEICAO_CERTIFICADO",
        "USO_DE_CERTIFICADO_NEGADO",
      ]),
    );
    expect(alerts.filter((a) => a.refId === "r2")).toEqual([]); // há só 5 min: ainda não é alerta
    expect(alerts.filter((a) => a.refId === "g4")).toEqual([]); // revogada não gera alerta de vencimento
    expect(alerts[0].severity).toBe("critico");
    expect(JSON.stringify(alerts)).not.toMatch(/\d{11,14}/); // sem CPF/CNPJ
  });
});

const params: FiscalParameters = {
  cTribNac: "010101",
  cLocPrestacao: "3550308",
  tribISSQN: "1",
  tpRetISSQN: "2",
  opSimpNac: "3",
  regEspTrib: "0",
  indTotTrib: "0",
  regApTribSN: "1",
  pAliq: "2.00",
};
const draft = {
  serviceDescription: "Serviço fictício",
  amountCents: 10000,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF" as const,
    name: "Tomador Fictício",
  },
};

describe.skipIf(!tools)("custódia e uso do certificado", () => {
  const procuracao = (
    over: Partial<AuthorizationRecord> = {},
  ): AuthorizationRecord => ({
    id: "g-a",
    kind: "procuracao",
    emissionModel: "wjb_procuracao",
    status: "active",
    scope: "Emissão de NFS-e",
    validUntil: "2027-11-20",
    revokedAt: null,
    holderDocument: WJB,
    certificate: null,
    ...over,
  });
  const setup = (grants: AuthorizationRecord[], vaultCert = "wjb") => {
    const meta = inspectCertificate(pem.wjb, "vault://teste/wjb");
    const vault = new TestCertificateVault();
    vault.put("vault://teste/wjb", material[vaultCert]);
    const audit = new InMemoryCertificateUsageSink();
    const authorize = async () =>
      evaluateEmitterAuthorization({
        tenantDocument: CLIENTE,
        grants,
        wjbCertificate: meta,
        today: TODAY,
      });
    return { vault, audit, authorize };
  };

  it("nenhum cofre real está configurado", () => {
    expect(() => createCertificateVault()).toThrow(
      CertificateVaultNotConfiguredError,
    );
  });

  it("uso autorizado assina e fica na trilha só com impressão digital", async () => {
    const { vault, audit, authorize } = setup([procuracao()]);
    const out = await useCertificate(
      {
        tenantId: "t-a",
        requestId: "r1",
        purpose: "assinatura",
        environment: "simulado",
      },
      { authorize, vault, audit, ...policyDeps() },
      async () => "assinado",
    );
    expect(out).toBe("assinado");
    expect(audit.entries).toEqual([
      expect.objectContaining({
        outcome: "ok",
        emissionModel: "wjb_procuracao",
        purpose: "assinatura",
      }),
    ]);
    expect(audit.entries[0].certificateFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(audit.entries)).not.toMatch(/PRIVATE|BEGIN|MII/);
  });

  it("procuração revogada entre o cadastro e o uso: uso negado e registrado", async () => {
    const { vault, audit, authorize } = setup([
      procuracao({ revokedAt: "2026-11-20T10:00:00Z", status: "revoked" }),
    ]);
    await expect(
      useCertificate(
        {
          tenantId: "t-a",
          requestId: "r1",
          purpose: "assinatura",
          environment: "simulado",
        },
        { authorize, vault, audit, ...policyDeps() },
        async () => "x",
      ),
    ).rejects.toThrow(CertificateUseDeniedError);
    expect(audit.entries[0]).toMatchObject({
      outcome: "negado",
      reason: "GRANT_REVOKED",
    });
  });

  it("certificado trocado no cofre (mesmo CNPJ, outra chave) é bloqueado pela impressão digital", async () => {
    const { vault, audit, authorize } = setup([procuracao()], "intruso");
    await expect(
      useCertificate(
        {
          tenantId: "t-a",
          requestId: "r1",
          purpose: "mtls",
          environment: "simulado",
        },
        { authorize, vault, audit, ...policyDeps() },
        async () => "x",
      ),
    ).rejects.toThrow(/não é o registrado/);
    expect(audit.entries[0]).toMatchObject({
      outcome: "negado",
      reason: "CERT_FINGERPRINT_MISMATCH",
    });
  });

  it("produção é recusada mesmo com autorização válida", async () => {
    const { vault, audit, authorize } = setup([procuracao()]);
    await expect(
      useCertificate(
        {
          tenantId: "t-a",
          requestId: null,
          purpose: "assinatura",
          environment: "producao",
        },
        { authorize, vault, audit, ...policyDeps() },
        async () => "x",
      ),
    ).rejects.toThrow(/produção/);
    expect(audit.entries[0].outcome).toBe("negado");
  });

  it("cofre de teste recusa referência que não seja de teste", () => {
    expect(() =>
      new TestCertificateVault().put("vault://wjb/ecnpj", material.wjb),
    ).toThrow(/teste/);
  });
});

describe.skipIf(!tools)(
  "conector com assinatura XMLDSig real e procuração (modelo A, simulado)",
  () => {
    function provider(
      holderCert: "wjb" | "cliente",
      transport: SimulatedSefinTransport,
    ) {
      const meta = inspectCertificate(
        pem[holderCert],
        `vault://teste/${holderCert}`,
      );
      const vault = new TestCertificateVault();
      vault.put(`vault://teste/${holderCert}`, material[holderCert]);
      const audit = new InMemoryCertificateUsageSink();
      const grants: AuthorizationRecord[] =
        holderCert === "wjb"
          ? [
              {
                id: "g-a",
                kind: "procuracao",
                emissionModel: "wjb_procuracao",
                status: "active",
                scope: "Emissão de NFS-e",
                validUntil: "2027-11-20",
                revokedAt: null,
                holderDocument: WJB,
                certificate: null,
              },
            ]
          : [
              {
                id: "g-b",
                kind: "certificado_proprio",
                emissionModel: "certificado_cliente",
                status: "active",
                scope: "Emissão de NFS-e",
                validUntil: "2027-11-20",
                revokedAt: null,
                holderDocument: CLIENTE,
                certificate: meta,
              },
            ];
      const authorize = async () =>
        evaluateEmitterAuthorization({
          tenantDocument: CLIENTE,
          grants,
          wjbCertificate: holderCert === "wjb" ? meta : null,
          today: TODAY,
        });
      const signer = new XmlDsigDpsSigner(
        (fn) =>
          useCertificate(
            {
              tenantId: "t-a",
              requestId: null,
              purpose: "assinatura",
              environment: "simulado",
            },
            { authorize, vault, audit, ...policyDeps() },
            fn,
          ),
        true,
      );
      const p = new NationalNFSeProvider({
        transport,
        allocator: new InMemoryDpsNumberAllocator(1),
        signer,
        emitterFor: async () => ({
          municipalityIbge: "3550308",
          documentKind: "CNPJ",
          document: CLIENTE,
        }),
        parametersFor: async () => params,
        signerContextFor: async () => ({
          certificateHolderDocument: meta.holderDocument,
        }),
        now: () => new Date("2026-11-20T12:00:00-03:00"),
      });
      return { p, audit };
    }

    it("modelo B (certificado do próprio emitente): assinatura real verificada pelo simulador e autorizada", async () => {
      const transport = new SimulatedSefinTransport();
      const { p, audit } = provider("cliente", transport);
      const out = await p.submitAuthorizedDocument({
        tenantId: "t-a",
        idempotencyKey: "k1",
        draft,
      });
      expect(out).toMatchObject({ status: "AUTORIZADA", simulated: true });
      expect(transport.lastSignatureProfile).toBe("rsa-sha1");
      expect(audit.entries.at(-1)?.outcome).toBe("ok");
    });

    it("modelo A sem procuração na RFB: assinatura real é válida, mas o titular não é o emitente (E0718)", async () => {
      const transport = new SimulatedSefinTransport();
      const { p } = provider("wjb", transport);
      expect(
        await p.submitAuthorizedDocument({
          tenantId: "t-a",
          idempotencyKey: "k1",
          draft,
        }),
      ).toMatchObject({ status: "REJEITADA", rejectionCode: "E0718" });
    });

    it("modelo A com procuração na RFB: autorizada", async () => {
      const transport = new SimulatedSefinTransport();
      transport.procuracoes.add(`${CLIENTE}>${WJB}`);
      const { p } = provider("wjb", transport);
      expect(
        (
          await p.submitAuthorizedDocument({
            tenantId: "t-a",
            idempotencyKey: "k1",
            draft,
          })
        ).status,
      ).toBe("AUTORIZADA");
    });
  },
);

describe("assinatura com certificado real exige algoritmo confirmado", () => {
  it("bloqueia antes de tocar no cofre", async () => {
    let touched = false;
    const signer = new XmlDsigDpsSigner(async () => {
      touched = true;
      return "" as never;
    }, false);
    await expect(signer.sign("<DPS/>", "x")).rejects.toThrow(
      AlgorithmNotConfirmedError,
    );
    expect(touched).toBe(false);
  });
});

describe.skipIf(!tools)("DPS com regApTribSN e pAliq x XSD oficial", () => {
  for (const layout of LAYOUT_CONTRACTS) {
    it(`válida em ${layout.id}`, () => {
      const emitter = {
        municipalityIbge: "3550308",
        documentKind: "CNPJ" as const,
        document: CLIENTE,
      };
      const id = buildDpsId({ ...emitter, series: 1, number: 5 }, layout);
      const xml = buildDpsXml({
        dpsId: id,
        layout,
        environment: "producao_restrita",
        series: 1,
        number: 5,
        issuedAt: new Date(),
        emitter,
        draft,
        params,
      });
      expect(xml).toContain("<regApTribSN>1</regApTribSN>");
      expect(xml).toContain("<tpRetISSQN>2</tpRetISSQN><pAliq>2.00</pAliq>");
      writeFileSync(path.join(dir, "aliq.xml"), xml);
      const r = spawnSync(
        "xmllint",
        [
          "--noout",
          "--schema",
          path.join(process.cwd(), layout.xsdDir, "DPS_v1.01.xsd"),
          "aliq.xml",
        ],
        { cwd: dir, encoding: "utf8" },
      );
      const errors = `${r.stdout}${r.stderr}`
        .split("\n")
        .filter(
          (l) => l.includes("validity error") && !l.includes("element serie:"),
        );
      expect(errors).toEqual([]);
    });
  }
});
