import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  daysUntilExpiry,
  evaluateRotation,
  expiryMilestone,
  expiryNoticeMessage,
  lifecycleBlocker,
  planExpiryNotices,
  spkiSha256,
  type RegisteredCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import {
  InMemoryCertificateRegistry,
  registerCertificateFromVault,
  rotateToCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-rotation";
import {
  CertificateUseDeniedError,
  InMemoryCertificateUsageSink,
  TestCertificateVault,
  // Alias: o nome começa com "use" e o lint o confundiria com um hook do React.
  useCertificate as applyCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-vault";
import { parseNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { buildIdempotencyKey } from "@/lib/wjb-ai/fiscal/idempotency";
import { checkSendReadiness } from "@/lib/wjb-ai/fiscal/review";
import {
  evaluateEmitterAuthorization,
  type AuthorizationRecord,
} from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { nfseBodyFromForm } from "@/lib/wjb-ai/fiscal/form";
import { evaluateFiscalAlerts } from "@/lib/wjb-ai/fiscal/monitoring";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import {
  SimulatedRevocationChecker,
  type TrustStore,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import { buildDpsId } from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  FiscalParametersMissingError,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  buildCancellationRequestXml,
  buildPedRegEventoId,
  EventInputError,
} from "@/lib/wjb-ai/fiscal/national/events-xml";
import { recipientLabel, resolveIndDest } from "@/lib/wjb-ai/fiscal/national/ind-dest";
import { LAYOUT_CONTRACTS } from "@/lib/wjb-ai/fiscal/national/layouts";
import {
  SEFIN_API_CONTRACT,
  unconfirmedContractFields,
} from "@/lib/wjb-ai/fiscal/national/official-transport";
import { createTestPki, opensslAvailable, type TestPki } from "@/tests/helpers/test-pki";

// Tudo FICTÍCIO: certificados gerados na hora por uma AC de teste, sem rede.
const WJB_REAL_CNPJ = "33152193000155"; // CNPJ público (siteConfig), só em certificado FICTÍCIO
const CLIENTE = "11222333000181";
const NOW = new Date("2026-11-26T15:00:00-03:00");
const hasXmllint = spawnSync("xmllint", ["--version"], { stdio: "ignore" }).status === 0;
const R2 = LAYOUT_CONTRACTS.find((l) => l.id === "producao-restrita-nt009-r2-20261124")!;

const cert = (over: Partial<RegisteredCertificate> = {}): RegisteredCertificate => ({
  id: "c1",
  role: "wjb",
  tenantId: null,
  fingerprint: "a".repeat(64),
  holderDocument: WJB_REAL_CNPJ,
  validFrom: "2026-11-27T00:00:00Z",
  validUntil: "2027-11-27T00:00:00Z",
  status: "ativo",
  ...over,
});
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000 + 3_600_000).toISOString();

describe("vencimento do certificado: marcos 90/60/30/15/7 (Fase 10C)", () => {
  it("marco alcançado para cada faixa", () => {
    expect([200, 91, 90, 61, 60, 45, 30, 16, 15, 8, 7, 1, 0, -1].map(expiryMilestone)).toEqual([
      null, null, 90, 90, 60, 60, 30, 30, 15, 15, 7, 7, 7, 0,
    ]);
  });

  it("avisa só o marco atual, uma vez, e só certificados ativos", () => {
    const certs = [
      cert({ id: "a", validUntil: inDays(40) }),
      cert({ id: "b", validUntil: inDays(5) }),
      cert({ id: "c", validUntil: inDays(-2) }),
      cert({ id: "d", validUntil: inDays(200) }),
      cert({ id: "e", validUntil: inDays(10), status: "substituido" }),
    ];
    const first = planExpiryNotices(certs, new Set(), NOW);
    expect(first.map((n) => [n.certificateId, n.milestone])).toEqual([
      ["a", 60],
      ["b", 7],
      ["c", 0],
    ]);
    const sent = new Set(first.map((n) => `${n.certificateId}:${n.milestone}`));
    expect(planExpiryNotices(certs, sent, NOW)).toEqual([]);
    // Dias depois: "a" chega ao marco de 30 e "b" vence (aviso de vencido).
    const later = new Date(NOW.getTime() + 11 * 86_400_000);
    expect(planExpiryNotices(certs, sent, later).map((n) => [n.certificateId, n.milestone])).toEqual([
      ["a", 30],
      ["b", 0],
    ]);
  });

  it("texto do aviso sem titular nem impressão digital", () => {
    const [n] = planExpiryNotices([cert({ validUntil: inDays(14) })], new Set(), NOW);
    const msg = expiryNoticeMessage(n);
    expect(msg).toMatch(/vence em 14 dia\(s\) \(aviso de 15 dias\)/);
    expect(msg).not.toMatch(/\d{11,14}|a{8}/);
  });

  it("monitoramento: alerta nos marcos (antes só aos 30 dias) e crítico aos 7", () => {
    const alerts = evaluateFiscalAlerts({
      now: NOW,
      grants: [
        { id: "g1", tenantId: "t1", kind: "certificado_proprio", validUntil: "2028-01-01", revokedAt: null, certificateValidUntil: inDays(80).slice(0, 10) },
      ],
      requests: [],
      usageDenied24h: [],
      registry: [cert({ id: "r1", validUntil: inDays(6) }), cert({ id: "r2", validUntil: inDays(120) })],
      blockedCertificateGrants: [{ id: "g9", tenantId: "t2" }],
    });
    expect(alerts.find((a) => a.refId === "g1")).toMatchObject({ code: "CERT_EXPIRING", severity: "atencao" });
    expect(alerts.find((a) => a.refId === "r1")).toMatchObject({ code: "CERT_EXPIRING", severity: "critico" });
    expect(alerts.find((a) => a.refId === "r2")).toBeUndefined();
    expect(alerts.find((a) => a.refId === "g9")).toMatchObject({ code: "CERT_BLOQUEADO_EM_USO", severity: "critico" });
  });

  it("dias até o vencimento são inteiros e negativos depois de vencer", () => {
    expect(daysUntilExpiry(inDays(3), NOW)).toBe(3);
    expect(daysUntilExpiry(inDays(-1), NOW)).toBeLessThan(0);
  });
});

describe("rotação: regras puras", () => {
  const okPolicy = { ok: true as const, fingerprint: "b".repeat(64) };
  const base = {
    current: cert(),
    candidate: cert({ id: "c2", fingerprint: "b".repeat(64), status: "pendente", validUntil: "2028-01-01T00:00:00Z" }),
    policy: okPolicy,
    trustKind: "icp-brasil" as const,
    revocationKind: "lcr-ocsp" as const,
    requireRealVerification: true,
    wjbDocuments: [WJB_REAL_CNPJ],
    now: NOW,
  };
  const codes = (r: ReturnType<typeof evaluateRotation>) => (r.ok ? [] : r.blockers.map((b) => b.code));

  it("rotação válida com verificação real", () => {
    expect(evaluateRotation(base).ok).toBe(true);
  });
  it("data de emissão não basta: sem cadeia ICP-Brasil e LCR/OCSP reais, recusa", () => {
    expect(codes(evaluateRotation({ ...base, trustKind: "teste", revocationKind: "simulado" }))).toContain("VERIFICATION_NOT_REAL");
    expect(codes(evaluateRotation({ ...base, trustKind: null, revocationKind: null }))).toContain("VERIFICATION_NOT_REAL");
  });
  it("recusa mesmo certificado, outro titular, outro escopo, política reprovada e validade curta", () => {
    expect(codes(evaluateRotation({ ...base, candidate: { ...base.candidate, fingerprint: base.current.fingerprint } }))).toEqual(
      expect.arrayContaining(["ROTATION_SAME_CERTIFICATE", "POLICY_FINGERPRINT_MISMATCH"]),
    );
    expect(codes(evaluateRotation({ ...base, candidate: { ...base.candidate, holderDocument: CLIENTE } }))).toEqual(
      expect.arrayContaining(["ROTATION_HOLDER", "WJB_HOLDER"]),
    );
    expect(codes(evaluateRotation({ ...base, candidate: { ...base.candidate, role: "cliente", tenantId: "t1" } }))).toContain("ROTATION_SCOPE");
    expect(
      codes(evaluateRotation({ ...base, policy: { ok: false, fingerprint: "b".repeat(64), blockers: [{ code: "CERT_REVOKED", message: "x" }] } })),
    ).toContain("CANDIDATE_POLICY");
    expect(codes(evaluateRotation({ ...base, candidate: { ...base.candidate, validUntil: inDays(3) } }))).toContain("CANDIDATE_EXPIRES_SOON");
    expect(codes(evaluateRotation({ ...base, candidate: { ...base.candidate, status: "bloqueado" } }))).toContain("CANDIDATE_NOT_PENDING");
  });
  it("uso: só o ATIVO fora da lista de bloqueio", () => {
    expect(lifecycleBlocker({ registered: true, status: "ativo", blocked: false })).toBeNull();
    expect(lifecycleBlocker({ registered: true, status: "ativo", blocked: true })?.code).toBe("CERT_BLOCKLISTED");
    expect(lifecycleBlocker({ registered: true, status: "substituido", blocked: false })?.code).toBe("CERT_NOT_ACTIVE");
    expect(lifecycleBlocker({ registered: false, status: null, blocked: false })?.code).toBe("CERT_NOT_ACTIVE");
  });
});

describe.skipIf(!opensslAvailable)("cadastro, rotação e uso com certificados fictícios", () => {
  let pki: TestPki;
  beforeAll(() => {
    pki = createTestPki();
  });
  afterAll(() => pki?.dispose());
  const trust = (): TrustStore => ({ kind: "teste", anchors: [pki.ca], intermediates: [] });
  const setup = () => {
    const vault = new TestCertificateVault();
    const repo = new InMemoryCertificateRegistry();
    const revocation = new SimulatedRevocationChecker();
    const deps = { vault, trust: trust(), revocation, repo, requireRealVerification: false };
    return { vault, repo, revocation, deps };
  };

  it("cadastra pendente, ativa, gira para o novo e bloqueia o antigo para sempre", async () => {
    const { vault, repo, deps } = setup();
    vault.put("vault://teste/wjb-1", pki.leaf("w1", { cnpj: WJB_REAL_CNPJ }).material);
    vault.put("vault://teste/wjb-2", pki.leaf("w2", { cnpj: WJB_REAL_CNPJ, days: 400 }).material);
    const r1 = await registerCertificateFromVault({ vaultReference: "vault://teste/wjb-1", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect((await rotateToCertificate(r1.value.id, deps)).ok).toBe(true);
    const r2 = await registerCertificateFromVault({ vaultReference: "vault://teste/wjb-2", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const rot = await rotateToCertificate(r2.value.id, deps);
    expect(rot).toMatchObject({ ok: true, value: { replaced: r1.value.id } });
    const old = repo.rows.get(r1.value.id)!;
    expect(old.status).toBe("substituido");
    expect(repo.blocklist.has(old.fingerprint)).toBe(true);
    // O antigo não volta: recadastrar é recusado.
    const again = await registerCertificateFromVault({ vaultReference: "vault://teste/wjb-1", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(again).toMatchObject({ ok: false, blockers: [{ code: "CERT_BLOCKLISTED" }] });
  });

  it("fora de testes, a cadeia e a revogação de teste não servem (VERIFICATION_NOT_REAL)", async () => {
    const { vault, deps } = setup();
    vault.put("vault://teste/wjb-r", pki.leaf("wr", { cnpj: WJB_REAL_CNPJ }).material);
    const r = await registerCertificateFromVault(
      { vaultReference: "vault://teste/wjb-r", role: "wjb", tenantId: null, actorId: null },
      { ...deps, requireRealVerification: true },
    );
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? [] : r.blockers.map((b) => b.code)).toContain("VERIFICATION_NOT_REAL");
  });

  it("certificado revogado entre o cadastro e a rotação: rotação recusada", async () => {
    const { vault, revocation, deps } = setup();
    const leaf = pki.leaf("wv", { cnpj: WJB_REAL_CNPJ });
    vault.put("vault://teste/wjb-v", leaf.material);
    const r = await registerCertificateFromVault({ vaultReference: "vault://teste/wjb-v", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    revocation.revoked.add(leaf.x509.fingerprint256.replace(/:/g, "").toLowerCase());
    const rot = await rotateToCertificate(r.value.id, deps);
    expect(rot.ok ? [] : rot.blockers.map((b) => b.message).join(" ")).toMatch(/CERT_REVOKED/);
  });

  it("certificado da WJB emitido antes do incidente nunca entra no registro", async () => {
    const { vault, deps } = setup();
    vault.put("vault://teste/wjb-old", pki.leaf("wo", { cnpj: WJB_REAL_CNPJ, notBefore: "20261101000000Z", days: 400 }).material);
    const r = await registerCertificateFromVault({ vaultReference: "vault://teste/wjb-old", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(r.ok ? "" : r.blockers.map((b) => b.message).join(" ")).toMatch(/CERT_ISSUED_BEFORE_INCIDENT/);
  });

  it("cofre indisponível falha fechado, sem cadastro", async () => {
    const { repo, deps } = setup();
    const r = await registerCertificateFromVault({ vaultReference: "vault://teste/nao-existe", role: "wjb", tenantId: null, actorId: null }, deps);
    expect(r).toMatchObject({ ok: false, blockers: [{ code: "VAULT_UNAVAILABLE" }] });
    expect(repo.rows.size).toBe(0);
  });

  it("isolamento: certificado de uma empresa não gira o de outra", async () => {
    const { vault, repo, deps } = setup();
    vault.put("vault://teste/a", pki.leaf("cli-a", { cnpj: CLIENTE }).material);
    vault.put("vault://teste/b", pki.leaf("cli-b", { cnpj: CLIENTE }).material);
    const a = await registerCertificateFromVault({ vaultReference: "vault://teste/a", role: "cliente", tenantId: "t-a", tenantDocument: CLIENTE, actorId: null }, deps);
    const b = await registerCertificateFromVault({ vaultReference: "vault://teste/b", role: "cliente", tenantId: "t-b", tenantDocument: CLIENTE, actorId: null }, deps);
    if (!a.ok || !b.ok) throw new Error("cadastro");
    await rotateToCertificate(a.value.id, deps, CLIENTE);
    const rb = await rotateToCertificate(b.value.id, deps, CLIENTE);
    expect(rb).toMatchObject({ ok: true, value: { replaced: null } });
    expect(repo.rows.get(a.value.id)!.status).toBe("ativo");
  });

  describe("uso do certificado consulta o registro (falha fechada)", () => {
    const run = async (lifecycle: Parameters<typeof applyCertificate>[1]["lifecycle"] | undefined, registerActive: boolean) => {
      const vault = new TestCertificateVault();
      const leaf = pki.leaf(`u${Math.random().toString(36).slice(2)}`, { cnpj: WJB_REAL_CNPJ });
      vault.put("vault://teste/uso", leaf.material);
      const meta = inspectCertificate(leaf.material.certificateDer, "vault://teste/uso");
      const grant: AuthorizationRecord = {
        id: "g-a",
        kind: "procuracao",
        emissionModel: "wjb_procuracao",
        status: "active",
        scope: "Emissão de NFS-e",
        validUntil: "2027-11-20",
        revokedAt: null,
        holderDocument: WJB_REAL_CNPJ,
        certificate: null,
      };
      const repo = new InMemoryCertificateRegistry();
      if (registerActive) {
        repo.rows.set("x", { ...cert({ id: "x", fingerprint: meta.fingerprintSha256 }), vaultReference: "vault://teste/uso" });
      }
      const audit = new InMemoryCertificateUsageSink();
      let called = false;
      const p = applyCertificate(
        { tenantId: "t-a", requestId: "r1", purpose: "assinatura", environment: "simulado" },
        {
          authorize: async () =>
            evaluateEmitterAuthorization({
              tenantDocument: CLIENTE,
              grants: [grant],
              wjbCertificate: { ...meta, icpBrasilV3: true, keyUsageNonRepudiation: true },
              today: new Date().toISOString().slice(0, 10),
            }),
          vault,
          audit,
          trust: trust(),
          revocation: new SimulatedRevocationChecker(),
          lifecycle: lifecycle === undefined ? repo.lookup() : lifecycle,
        },
        async () => {
          called = true;
          return "ok";
        },
      );
      return { p, audit, repo, meta, called: () => called };
    };

    it("ativo no registro: uso permitido", async () => {
      const r = await run(undefined, true);
      await expect(r.p).resolves.toBe("ok");
    });
    it("não registrado: negado (CERT_NOT_ACTIVE) e auditado", async () => {
      const r = await run(undefined, false);
      await expect(r.p).rejects.toThrow(CertificateUseDeniedError);
      expect(r.called()).toBe(false);
      expect(r.audit.entries.at(-1)).toMatchObject({ outcome: "negado", reason: "CERT_NOT_ACTIVE" });
    });
    it("sem registro configurado ou registro fora do ar: negado", async () => {
      const a = await run(null, true);
      await expect(a.p).rejects.toThrow(CertificateUseDeniedError);
      expect(a.audit.entries.at(-1)?.reason).toBe("CERT_LIFECYCLE_UNVERIFIED");
      const b = await run({ state: async () => Promise.reject(new Error("fora")) }, true);
      await expect(b.p).rejects.toThrow(CertificateUseDeniedError);
      expect(b.audit.entries.at(-1)?.reason).toBe("CERT_LIFECYCLE_UNAVAILABLE");
    });
    it("bloqueado depois de ativo: negado na hora", async () => {
      const r = await run(
        { state: async () => ({ registered: true, status: "ativo", blocked: true, role: "wjb", tenantId: null }) },
        true,
      );
      await expect(r.p).rejects.toThrow(/CERT_BLOCKLISTED/);
    });
  });
});

describe("indDest: nunca presumido (NT 009 release 2)", () => {
  const emitter = { municipalityIbge: "3550308", documentKind: "CNPJ" as const, document: CLIENTE };
  const params: FiscalParameters = {
    cTribNac: "010101",
    cLocPrestacao: "3550308",
    tribISSQN: "1",
    tpRetISSQN: "1",
    opSimpNac: "3",
    regEspTrib: "0",
    indTotTrib: "0",
  };
  const draft = (recipientIsTaker?: boolean) => ({
    serviceDescription: "Consultoria fictícia",
    amountCents: 10000,
    competence: "2026-11",
    taker: { document: "52998224725", documentKind: "CPF" as const, name: "Tomador Fictício" },
    ...(recipientIsTaker === undefined ? {} : { recipientIsTaker }),
  });
  const build = (recipientIsTaker?: boolean, extra = {}) =>
    buildDpsXml({
      dpsId: buildDpsId({ ...emitter, series: 1, number: 1 }, R2),
      layout: R2,
      environment: "producao_restrita",
      series: 1,
      number: 1,
      issuedAt: NOW,
      emitter,
      draft: draft(recipientIsTaker),
      params,
      ...extra,
    });

  it("regra oficial: 0 só com destinatário = tomador declarado", () => {
    expect(resolveIndDest(true)).toEqual({ ok: true, value: "0" });
    expect(resolveIndDest(false)).toMatchObject({ ok: false, code: "INDDEST_DESTINATARIO_DIFERENTE" });
    expect(resolveIndDest(undefined)).toMatchObject({ ok: false, code: "INDDEST_NAO_INFORMADO" });
    expect(recipientLabel(undefined)).toMatch(/contador/);
  });
  it("DPS do release 2 sem a informação não é gerada", () => {
    expect(() => build(undefined)).toThrow(FiscalParametersMissingError);
    expect(() => build(false)).toThrow(/grupo dest/);
    expect(build(true)).toContain("<indDest>0</indDest>");
  });
  it("leiaute sem indDest (produção atual) não exige a informação", () => {
    const prod = LAYOUT_CONTRACTS.find((l) => !l.rules.indDestInInfDps)!;
    const xml = buildDpsXml({
      dpsId: buildDpsId({ ...emitter, series: 1, number: 1 }, prod),
      layout: prod,
      environment: "producao_restrita",
      series: 1,
      number: 1,
      issuedAt: NOW,
      emitter,
      draft: draft(undefined),
      params,
    });
    expect(xml).not.toContain("indDest");
  });
  it("formulário e rascunho: sim/não viram booleano, vazio fica ausente, campo estranho recusado", () => {
    const fd = (v: string) => {
      const f = new FormData();
      for (const [k, x] of Object.entries({ serviceDescription: "Consultoria fictícia", grossAmount: "100,00", competence: "2026-11", takerDocument: "529.982.247-25", takerName: "Tomador Fictício", recipientIsTaker: v }))
        f.set(k, x);
      return f;
    };
    const parse = (v: string) => parseNfseDraft(nfseBodyFromForm(fd(v)));
    expect(parse("sim")).toMatchObject({ ok: true, draft: { recipientIsTaker: true } });
    expect(parse("nao")).toMatchObject({ ok: true, draft: { recipientIsTaker: false } });
    const empty = parse("");
    expect(empty.ok && "recipientIsTaker" in empty.draft).toBe(false);
    expect(parseNfseDraft({ ...nfseBodyFromForm(fd("sim")), recipientIsTaker: "sim" }).ok).toBe(false);
  });
});

function xsdValidate(schema: string, xml: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-evt-"));
  const file = path.join(dir, "x.xml");
  writeFileSync(file, xml);
  const r = spawnSync("xmllint", ["--noout", "--schema", path.join(process.cwd(), R2.xsdDir, schema), file], { encoding: "utf8" });
  return { ok: r.status === 0, output: `${r.stdout}${r.stderr}` };
}

describe("cancelamento (e101101) e substituição (subst) x XSD oficial do release 2", () => {
  const KEY = "35503082" + "2" + CLIENTE + "0".repeat(27); // 50 posições, fictícia
  const cancel = (over = {}) =>
    buildCancellationRequestXml({
      environment: "producao_restrita",
      accessKey: KEY,
      author: { kind: "CNPJ", document: CLIENTE },
      reason: "1",
      description: "Erro na emissão: valor digitado errado (teste)",
      at: NOW,
      ...over,
    });

  it("Id do pedido segue o padrão do XSD (59 posições)", () => {
    expect(KEY).toHaveLength(50);
    expect(buildPedRegEventoId(KEY, "101101")).toMatch(/^PRE[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}$/);
  });
  it.skipIf(!hasXmllint)("pedido de cancelamento é válido no pedRegEvento oficial", () => {
    const r = xsdValidate("pedRegEvento_v1.01.xsd", cancel());
    expect(r.output).not.toMatch(/validity error/);
    expect(r.ok).toBe(true);
  });
  it("recusa produção, chave fora do padrão, motivo fora da tabela e descrição curta", () => {
    expect(() => cancel({ environment: "producao" })).toThrow(EventInputError);
    expect(() => cancel({ accessKey: "123" })).toThrow(/chave/);
    expect(() => cancel({ reason: "3" })).toThrow(/motivo/);
    expect(() => cancel({ description: "curta" })).toThrow(/15 a 255/);
  });
  it("texto do motivo é escapado (sem injeção de XML)", () => {
    expect(cancel({ description: "Valor <errado> & duplicado no teste" })).toContain("Valor &lt;errado&gt; &amp; duplicado");
  });
  it.skipIf(!hasXmllint)("DPS substituta com o grupo subst é válida no XSD", () => {
    const emitter = { municipalityIbge: "3550308", documentKind: "CNPJ" as const, document: CLIENTE };
    const xml = buildDpsXml({
      dpsId: buildDpsId({ ...emitter, series: 1, number: 2 }, R2),
      layout: R2,
      environment: "producao_restrita",
      series: 1,
      number: 2,
      issuedAt: NOW,
      emitter,
      draft: {
        serviceDescription: "Consultoria fictícia",
        amountCents: 10000,
        competence: "2026-11",
        taker: { document: "52998224725", documentKind: "CPF", name: "Tomador Fictício" },
        recipientIsTaker: true,
      },
      params: { cTribNac: "010101", cLocPrestacao: "3550308", tribISSQN: "1", tpRetISSQN: "1", opSimpNac: "3", regEspTrib: "0", indTotTrib: "0" },
      substitution: { accessKey: KEY, reason: "99", description: "Substituição de teste com descrição suficiente" },
    });
    expect(xml).toMatch(/<cLocEmi>3550308<\/cLocEmi><subst><chSubstda>/);
    const r = xsdValidate("DPS_v1.01.xsd", xml);
    expect(r.output).not.toMatch(/validity error/);
    expect(r.ok).toBe(true);
  });
  it("eventos ficam fora do portão: caminho da API pendente, nada inventado", () => {
    expect(SEFIN_API_CONTRACT.eventPath.status).toBe("pendente");
    expect(unconfirmedContractFields()).toEqual(expect.arrayContaining(["eventPath", "requestEventField"]));
  });
});

describe("revisão de segurança independente da Fase 10C (correções)", () => {
  const base = {
    current: cert({ spki: "1".repeat(64) }),
    candidate: cert({ id: "c2", fingerprint: "b".repeat(64), spki: "1".repeat(64), status: "pendente", validUntil: "2028-01-01T00:00:00Z" }),
    policy: { ok: true as const, fingerprint: "b".repeat(64) },
    trustKind: "icp-brasil" as const,
    revocationKind: "lcr-ocsp" as const,
    requireRealVerification: true,
    wjbDocuments: [WJB_REAL_CNPJ],
    now: NOW,
  };
  const codes = (r: ReturnType<typeof evaluateRotation>) => (r.ok ? [] : r.blockers.map((b) => b.code));
  it("M2: reemissão com o MESMO par de chaves não serve como rotação", () => {
    expect(codes(evaluateRotation(base))).toContain("ROTATION_SAME_KEY");
    expect(evaluateRotation({ ...base, candidate: { ...base.candidate, spki: "2".repeat(64) } }).ok).toBe(true);
  });
  it("M1: certificado da WJB nunca como cliente; e-CNPJ de cliente só da própria empresa", () => {
    const cli = cert({ id: "k", role: "cliente", tenantId: "t1", holderDocument: WJB_REAL_CNPJ, status: "pendente", fingerprint: "b".repeat(64) });
    expect(codes(evaluateRotation({ ...base, current: null, candidate: cli, tenantDocument: WJB_REAL_CNPJ }))).toContain("CLIENT_HOLDER_IS_WJB");
    const other = { ...cli, holderDocument: CLIENTE };
    expect(codes(evaluateRotation({ ...base, current: null, candidate: other, tenantDocument: "99.888.777/0001-55" }))).toContain("CLIENT_HOLDER_MISMATCH");
    expect(evaluateRotation({ ...base, current: null, candidate: other, tenantDocument: "11.222.333/0001-81" }).ok).toBe(true);
  });
  it("M1: no uso, o ativo precisa ser do modelo e da empresa do pedido", () => {
    const st = { registered: true, status: "ativo" as const, blocked: false };
    expect(lifecycleBlocker({ ...st, role: "cliente", tenantId: "t1" }, { role: "wjb", tenantId: "t1" })?.code).toBe("CERT_ROLE_MISMATCH");
    expect(lifecycleBlocker({ ...st, role: "cliente", tenantId: "t2" }, { role: "cliente", tenantId: "t1" })?.code).toBe("CERT_TENANT_MISMATCH");
    expect(lifecycleBlocker({ ...st, role: "cliente", tenantId: "t1" }, { role: "cliente", tenantId: "t1" })).toBeNull();
    expect(lifecycleBlocker({ ...st, role: "wjb", tenantId: null }, { role: "wjb", tenantId: "qualquer" })).toBeNull();
  });
  it("B5: envio oficial exige o destinatário declarado; a simulação não muda", () => {
    const r = { status: "CONFIRMADA" as const, hasApprovedProfile: true, grantValidUntil: "2099-01-01", today: "2026-11-26" };
    expect(checkSendReadiness({ ...r, providerMode: "mock" })).toEqual({ ok: true });
    const off = checkSendReadiness({ ...r, providerMode: "homologacao" });
    expect(off.ok ? [] : off.reasons.join(" ")).toMatch(/indDest/);
  });
  it("B6: a chave de idempotência dos pedidos antigos não muda; o destinatário diferencia", () => {
    const d = { serviceDescription: "Serviço", amountCents: 100, competence: "2026-11", taker: { document: "52998224725", documentKind: "CPF" as const, name: "X" } };
    expect(buildIdempotencyKey("t", d)).toBe(buildIdempotencyKey("t", { ...d }));
    expect(buildIdempotencyKey("t", { ...d, recipientIsTaker: true })).not.toBe(buildIdempotencyKey("t", d));
    expect(buildIdempotencyKey("t", { ...d, recipientIsTaker: true })).not.toBe(buildIdempotencyKey("t", { ...d, recipientIsTaker: false }));
  });
  it("B7: caracteres proibidos no XML 1.0 são removidos do texto", () => {
    const KEY = "35503082" + "2" + CLIENTE + "0".repeat(27);
    const xml = buildCancellationRequestXml({
      environment: "producao_restrita",
      accessKey: KEY,
      author: { kind: "CNPJ", document: CLIENTE },
      reason: "1",
      description: "Erro na emissão\u0000\u0007 com controle \uFFFE no meio",
      at: NOW,
    });
    expect(xml).toContain("Erro na emissão com controle  no meio");
    expect(xml).not.toMatch(/[\u0000-\u0008\uFFFE]/);
  });
  it.skipIf(!opensslAvailable)("M2: chave bloqueada impede o recadastro de um certificado reemitido com ela", async () => {
    const pki = createTestPki();
    try {
      const repo = new InMemoryCertificateRegistry();
      const vault = new TestCertificateVault();
      const leaf = pki.leaf("chave-x", { cnpj: WJB_REAL_CNPJ });
      vault.put("vault://teste/k1", leaf.material);
      const spki = spkiSha256(leaf.x509.publicKey.export({ type: "spki", format: "der" }));
      repo.keyBlocklist.add(spki);
      const r = await registerCertificateFromVault(
        { vaultReference: "vault://teste/k1", role: "wjb", tenantId: null, actorId: null },
        { vault, trust: { kind: "teste", anchors: [pki.ca], intermediates: [] }, revocation: new SimulatedRevocationChecker(), repo, requireRealVerification: false },
      );
      expect(r).toMatchObject({ ok: false, blockers: [{ code: "CERT_BLOCKLISTED" }] });
    } finally {
      pki.dispose();
    }
  });
});
