import { describe, expect, it } from "vitest";

import {
  InMemoryAgentAuditSink,
  runSimulationFlow,
  type AgentContext,
  type EmissionReadiness,
} from "@/lib/wjb-ai/agents/runtime";
import {
  checkCertificate,
  evaluateEmitterAuthorization,
  type AuthorizationRecord,
  type CertificateMetadata,
} from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { resolveLayout } from "@/lib/wjb-ai/fiscal/national/layouts";
import {
  parseAuthorizationForm,
  parseFiscalSettingsForm,
} from "@/lib/wjb-ai/fiscal/profile-form";
import {
  evaluateFiscalReadiness,
  toFiscalParameters,
  type FiscalProfileSettings,
} from "@/lib/wjb-ai/fiscal/profile-settings";
import { looksLikeSecret } from "@/lib/wjb-ai/fiscal/secret-guard";

// Tudo FICTÍCIO.
const TODAY = "2026-11-20";
const CLIENT = "11222333000181";
const WJB = "99888777000155";

const cert = (
  over: Partial<CertificateMetadata> = {},
): CertificateMetadata => ({
  holderDocument: WJB,
  validFrom: "2026-01-01",
  validUntil: "2027-06-30",
  fingerprintSha256: "a".repeat(64),
  vaultReference: "vault://ficticio/wjb",
  icpBrasilV3: true,
  kind: "A1",
  keyUsageDigitalSignature: true,
  keyUsageNonRepudiation: true,
  clientAuth: true,
  isCa: false,
  revoked: false,
  ...over,
});

const procuracao = (
  over: Partial<AuthorizationRecord> = {},
): AuthorizationRecord => ({
  id: "g-a",
  kind: "procuracao",
  emissionModel: "wjb_procuracao",
  status: "active",
  scope: "Emissão de NFS-e Nacional",
  validUntil: "2027-11-20",
  revokedAt: null,
  holderDocument: WJB,
  certificate: null,
  ...over,
});

const proprio = (
  over: Partial<AuthorizationRecord> = {},
): AuthorizationRecord => ({
  id: "g-b",
  kind: "certificado_proprio",
  emissionModel: "certificado_cliente",
  status: "active",
  scope: "Emissão de NFS-e com certificado próprio",
  validUntil: "2027-11-20",
  revokedAt: null,
  holderDocument: CLIENT,
  certificate: cert({
    holderDocument: CLIENT,
    vaultReference: "vault://ficticio/cliente",
  }),
  ...over,
});

describe("autorização de emissão: modelo A (WJB + procuração)", () => {
  it("procuração válida + certificado da WJB válido = modelo A", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao()],
      wjbCertificate: cert(),
      today: TODAY,
    });
    expect(r).toMatchObject({ ok: true, model: "wjb_procuracao" });
  });
  it("procuração vencida bloqueia", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao({ validUntil: "2026-11-19" })],
      wjbCertificate: cert(),
      today: TODAY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.blockers.map((b) => b.code)).toContain("GRANT_EXPIRED");
  });
  it("procuração revogada bloqueia, mesmo dentro da validade", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [
        procuracao({ revokedAt: "2026-11-10T10:00:00Z", status: "revoked" }),
      ],
      wjbCertificate: cert(),
      today: TODAY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.blockers.map((b) => b.code)).toContain("GRANT_REVOKED");
  });
  it("procuração para outro CNPJ que não o do certificado da WJB bloqueia (E0718 evitado)", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao({ holderDocument: "12345678000199" })],
      wjbCertificate: cert(),
      today: TODAY,
    });
    if (!r.ok)
      expect(r.blockers.map((b) => b.code)).toContain("GRANT_HOLDER_MISMATCH");
    expect(r.ok).toBe(false);
  });
  it("escopo que não cita NFS-e bloqueia", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao({ scope: "Assuntos do e-CAC" })],
      wjbCertificate: cert(),
      today: TODAY,
    });
    expect(r.ok).toBe(false);
  });
  it("sem certificado da WJB cadastrado, modelo A indisponível", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao()],
      wjbCertificate: null,
      today: TODAY,
    });
    if (!r.ok)
      expect(r.blockers.map((b) => b.code)).toContain("WJB_CERT_MISSING");
  });
});

describe("autorização de emissão: modelo B (certificado do cliente)", () => {
  it("certificado do próprio cliente válido = modelo B", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: "11.222.333/0001-81",
      grants: [proprio()],
      wjbCertificate: null,
      today: TODAY,
    });
    expect(r).toMatchObject({ ok: true, model: "certificado_cliente" });
  });
  it("titular do certificado diferente do emitente bloqueia (E0718 evitado)", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [
        proprio({ certificate: cert({ holderDocument: "55666777000188" }) }),
      ],
      wjbCertificate: null,
      today: TODAY,
    });
    if (!r.ok)
      expect(r.blockers.map((b) => b.code)).toContain(
        "CLIENT_CERT_HOLDER_MISMATCH",
      );
    expect(r.ok).toBe(false);
  });
  it("cai para o modelo B quando a procuração está revogada", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [procuracao({ revokedAt: "2026-11-01T00:00:00Z" }), proprio()],
      wjbCertificate: cert(),
      today: TODAY,
    });
    expect(r).toMatchObject({ ok: true, model: "certificado_cliente" });
  });
  it("nenhuma autorização registrada", () => {
    const r = evaluateEmitterAuthorization({
      tenantDocument: CLIENT,
      grants: [],
      wjbCertificate: cert(),
      today: TODAY,
    });
    if (!r.ok) expect(r.blockers[0].code).toBe("NO_AUTHORIZATION");
  });
});

describe("requisitos do certificado (FAQ NFS-e 17.1/17.2)", () => {
  it("vencido, de AC, sem autenticação de cliente, sem cofre", () => {
    const codes = checkCertificate(
      cert({
        validUntil: "2026-11-01",
        isCa: true,
        clientAuth: false,
        vaultReference: "C:/certs/wjb.pfx",
      }),
      TODAY,
    ).blockers.map((b) => b.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "CERT_EXPIRED",
        "CERT_IS_CA",
        "CERT_CLIENT_AUTH",
        "CERT_NO_VAULT",
      ]),
    );
  });
  it("vencendo em até 30 dias gera aviso, não bloqueio", () => {
    const r = checkCertificate(cert({ validUntil: "2026-12-10" }), TODAY);
    expect(r.blockers).toEqual([]);
    expect(r.warnings[0].code).toBe("CERT_EXPIRING");
  });
});

const settings: FiscalProfileSettings = {
  enquadramento: "SIMPLES_ME_EPP",
  emitter: {
    documentKind: "CNPJ",
    document: CLIENT,
    municipalityIbge: "3550308",
    habilitacaoConfirmadaEm: "2026-11-18",
  },
  service: {
    cTribNac: "010101",
    cNBS: null,
    cLocPrestacao: "3550308",
    convenioMunicipioAtivo: true,
    convenioConferidoEm: "2026-11-18",
  },
  taxes: {
    tribISSQN: "1",
    tpRetISSQN: "1",
    opSimpNac: "3",
    regEspTrib: "0",
    indTotTrib: "0",
    regApTribSN: "1",
    pAliq: null,
  },
  ibsCbs: {
    decision: "nao_informar",
    justification: "Grupo opcional hoje; decisão do contador (fictícia).",
  },
  dpsSeries: 1,
};
const layout = resolveLayout("producao_restrita", TODAY);
const okAuth = evaluateEmitterAuthorization({
  tenantDocument: CLIENT,
  grants: [procuracao()],
  wjbCertificate: cert(),
  today: TODAY,
});

describe("cadastro fiscal e prontidão", () => {
  it("cadastro completo, aprovado, autorizado e com série = pronto", () => {
    const r = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: settings,
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    expect(
      r.items.filter(
        (i) => i.status === "bloqueado" || i.status === "pendente",
      ),
    ).toEqual([]);
    expect(r.ready).toBe(true);
  });
  it("rascunho não aprovado não fica pronto", () => {
    expect(
      evaluateFiscalReadiness({
        profileStatus: "draft",
        rawSettings: settings,
        tenantDocument: CLIENT,
        authorization: okAuth,
        layout,
        seriesConfigured: 1,
      }).ready,
    ).toBe(false);
  });
  it("enquadramento incoerente com a situação no Simples é bloqueado", () => {
    const r = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: { ...settings, enquadramento: "MEI" },
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    expect(r.items.find((i) => i.key === "issqn_regime")?.status).toBe(
      "bloqueado",
    );
  });
  it("decidir informar IBS/CBS bloqueia até o grupo completo existir", () => {
    const r = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: {
        ...settings,
        ibsCbs: {
          decision: "informar",
          justification: "Teste fictício de decisão",
        },
      },
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    expect(r.items.find((i) => i.key === "ibs_cbs")?.status).toBe("bloqueado");
  });
  it("série não configurada ou diferente do perfil bloqueia", () => {
    const a = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: settings,
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: null,
    });
    const b = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: settings,
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 2,
    });
    expect(a.items.find((i) => i.key === "serie")?.status).toBe("bloqueado");
    expect(b.items.find((i) => i.key === "serie")?.status).toBe("bloqueado");
  });
  it("emitente do perfil diferente da empresa bloqueia", () => {
    const r = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: {
        ...settings,
        emitter: { ...settings.emitter, document: "55666777000188" },
      },
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    expect(r.items.find((i) => i.key === "habilitacao")?.status).toBe(
      "bloqueado",
    );
  });
  it("cadastro com campo inventado ou fora do domínio oficial é recusado pelo schema estrito", () => {
    const r1 = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: { ...settings, aliquotaSugeridaPelaIa: "5%" },
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    const r2 = evaluateFiscalReadiness({
      profileStatus: "approved",
      rawSettings: {
        ...settings,
        taxes: { ...settings.taxes, tribISSQN: "7" },
      },
      tenantDocument: CLIENT,
      authorization: okAuth,
      layout,
      seriesConfigured: 1,
    });
    expect(r1.items.find((i) => i.key === "cadastro_valido")?.status).toBe(
      "bloqueado",
    );
    expect(r2.items.find((i) => i.key === "cadastro_valido")?.status).toBe(
      "bloqueado",
    );
  });
  it("parâmetros da DPS saem só do cadastro aprovado", () => {
    expect(toFiscalParameters(settings)).toMatchObject({
      cTribNac: "010101",
      opSimpNac: "3",
      ibsCbs: { informar: false },
    });
  });
});

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("formulários do Admin e proteção de credenciais", () => {
  const base = {
    enquadramento: "SIMPLES_ME_EPP",
    documentKind: "CNPJ",
    emitterDocument: "11.222.333/0001-81",
    municipalityIbge: "3550308",
    habilitacaoConfirmadaEm: "",
    cTribNac: "010101",
    cNBS: "",
    cLocPrestacao: "3550308",
    opSimpNac: "3",
    regEspTrib: "0",
    tribISSQN: "1",
    tpRetISSQN: "1",
    ibsCbsDecision: "nao_informar",
    ibsCbsJustification: "Decisão fictícia do contador",
    dpsSeries: "1",
    regApTribSN: "1",
    pAliq: "",
    convenioMunicipioAtivo: "sim",
    convenioConferidoEm: "2026-11-18",
  };
  it("cadastro fiscal válido vira settings tipado", () => {
    const r = parseFiscalSettingsForm(fd(base));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.settings.emitter.document).toBe(CLIENT);
  });
  it("série fora da faixa do canal API é recusada", () => {
    expect(
      parseFiscalSettingsForm(fd({ ...base, dpsSeries: "70000" })).ok,
    ).toBe(false);
  });
  it("chave colada em qualquer campo é recusada", () => {
    expect(
      parseFiscalSettingsForm(
        fd({
          ...base,
          ibsCbsJustification: "-----BEGIN PRIVATE KEY----- MIIE",
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseAuthorizationForm(
        fd({
          emissionModel: "wjb_procuracao",
          scope: "NFS-e",
          validUntil: "2027-01-01",
          evidence: "senha: 1234",
          holderDocument: WJB,
        }),
      ).ok,
    ).toBe(false);
  });
  it("modelo B exige validade, impressão digital, cofre e tipo", () => {
    const r = parseAuthorizationForm(
      fd({
        emissionModel: "certificado_cliente",
        scope: "Emissão de NFS-e",
        validUntil: "2027-01-01",
        evidence: "Pasta fictícia",
        holderDocument: CLIENT,
      }),
    );
    expect(r.ok).toBe(false);
    const ok = parseAuthorizationForm(
      fd({
        emissionModel: "certificado_cliente",
        scope: "Emissão de NFS-e",
        validUntil: "2027-01-01",
        evidence: "Pasta fictícia",
        holderDocument: CLIENT,
        certValidFrom: "2026-01-01",
        certValidUntil: "2027-01-01",
        certFingerprint: "AB:".repeat(31) + "AB",
        vaultReference: "vault://ficticio/cli",
        certKind: "A1",
        certRequirements: "on",
      }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.certificate_fingerprint_sha256).toBe("ab".repeat(32));
      expect(ok.value.kind).toBe("certificado_proprio");
    }
  });
  it("detector de segredos", () => {
    for (const s of [
      "-----BEGIN CERTIFICATE-----",
      "sb_secret_abcdefghijklmnop",
      "senha: x",
      "password=1",
      "MII" + "A".repeat(80),
    ])
      expect(looksLikeSecret(s)).toBe(true);
    for (const s of [
      "vault://wjb/ecnpj",
      "Pasta do cliente no drive",
      "a".repeat(64),
    ])
      expect(looksLikeSecret(s)).toBe(false);
  });
});

describe("fluxo dos 6 agentes em simulação", () => {
  const ctx = (readiness: EmissionReadiness): AgentContext => ({
    session: {
      userId: "u1",
      isWjbStaff: false,
      staffRole: null,
    } as unknown as AgentContext["session"],
    tenant: {
      id: "t-a",
      name: "Empresa Fictícia",
      role: "owner",
    } as unknown as AgentContext["tenant"],
    traceId: "trace-1",
    today: TODAY,
    loadFiscalProfile: async () => ({
      approved: true,
      maxAmountCentsWithoutReview: 100000,
    }),
    loadAuthorizationGrant: async () => ({
      validUntil: "2027-01-01",
      status: "active",
    }),
    loadEmissionReadiness: async () => readiness,
  });
  const text =
    "Preciso de uma nota fiscal de R$ 250,00 para Maria Fictícia CPF 529.982.247-25, serviço de corte e escova, competência 2026-11";

  it("cadastro incompleto: para no Cadastro, encaminha à Supervisão e a Auditoria registra", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runSimulationFlow(
      text,
      ctx({
        ready: false,
        items: [{ key: "autorizacao", status: "bloqueado" }],
      }),
      sink,
    );
    expect(r.outcome).toBe("cadastro_incompleto");
    expect(r.blockedReadiness).toEqual(["autorizacao"]);
    expect(r.steps.map((s) => s.agentId)).toEqual([
      "atendimento",
      "cadastro",
      "supervisao",
      "auditoria",
    ]);
    expect(sink.entries.at(-1)).toMatchObject({
      agentId: "auditoria",
      tool: "record_agent_event",
      ok: true,
    });
  });
  it("cadastro pronto: passa pelos 6 agentes e nunca transmite", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runSimulationFlow(
      text,
      ctx({ ready: true, items: [] }),
      sink,
    );
    expect(r.simulated).toBe(true);
    expect(r.outcome).toBe("pronto_para_confirmacao");
    expect(new Set(r.steps.map((s) => s.agentId))).toEqual(
      new Set([
        "atendimento",
        "cadastro",
        "fiscal",
        "validacao",
        "supervisao",
        "auditoria",
      ]),
    );
    expect(
      sink.entries.every((e) => !/transmit|submit|send/i.test(e.tool)),
    ).toBe(true);
  });
  it("auditoria não guarda dado pessoal", async () => {
    const sink = new InMemoryAgentAuditSink();
    await runSimulationFlow(text, ctx({ ready: true, items: [] }), sink);
    const dump = JSON.stringify(sink.entries);
    expect(dump).not.toMatch(/529|Maria|250/);
  });
  it("pedido fora do fluxo vai para humano e é auditado", async () => {
    const sink = new InMemoryAgentAuditSink();
    const r = await runSimulationFlow(
      "Qual o horário de vocês?",
      ctx({ ready: true, items: [] }),
      sink,
    );
    expect(r.outcome).toBe("fora_do_fluxo");
    expect(r.steps.at(-1)?.agentId).toBe("auditoria");
  });
});
