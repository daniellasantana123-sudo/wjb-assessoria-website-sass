import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InMemoryCertificateRegistry } from "@/lib/wjb-ai/fiscal/certificate-rotation";
import { parseUploadedCertificate, validateCertificateUpload } from "@/lib/wjb-ai/fiscal/certificate-upload";
import { SimulatedRevocationChecker, type TrustStore } from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import { createTestPki, opensslAvailable, type TestPki } from "@/tests/helpers/test-pki";

// Certificados FICTÍCIOS gerados na hora (nenhum certificado real é usado).
const WJB_CNPJ = "33152193000155"; // CNPJ público da WJB (siteConfig), só em certificado fictício
const CLIENTE_CNPJ = "00000000000191";

describe("Fase 10F: envio do certificado público (formato)", () => {
  it("recusa chave privada sem ler o resto", () => {
    const r = parseUploadedCertificate(Buffer.from("-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----"));
    expect(r).toMatchObject({ ok: false, code: "CHAVE_PRIVADA_RECUSADA" });
    expect(parseUploadedCertificate(Buffer.from("-----BEGIN RSA PRIVATE KEY-----"))).toMatchObject({ ok: false, code: "CHAVE_PRIVADA_RECUSADA" });
  });
  it("recusa PFX/P12 (SEQUENCE com versão 3)", () => {
    const pfxLike = Buffer.from([0x30, 0x82, 0x01, 0x00, 0x02, 0x01, 0x03, 0x30, 0x00]);
    expect(parseUploadedCertificate(pfxLike)).toMatchObject({ ok: false, code: "PFX_RECUSADO" });
  });
  it("recusa vazio, grande demais e lixo", () => {
    expect(parseUploadedCertificate(Buffer.alloc(0))).toMatchObject({ ok: false, code: "UPLOAD_VAZIO" });
    expect(parseUploadedCertificate(Buffer.alloc(17 * 1024, 1))).toMatchObject({ ok: false, code: "UPLOAD_GRANDE" });
    expect(parseUploadedCertificate(Buffer.from("não é certificado"))).toMatchObject({ ok: false, code: "FORMATO_INVALIDO" });
  });
});

describe.skipIf(!opensslAvailable)("Fase 10F: envio do certificado público (política completa)", () => {
  let pki: TestPki;
  beforeAll(() => {
    pki = createTestPki();
  });
  afterAll(() => pki?.dispose());
  const deps = (repo = new InMemoryCertificateRegistry()) => ({
    trust: { kind: "teste", anchors: [pki.ca], intermediates: [] } as TrustStore,
    revocation: new SimulatedRevocationChecker(),
    repo,
    requireRealVerification: false,
  });

  it("certificado de teste válido do cliente passa; o resultado não traz o documento inteiro", async () => {
    const leaf = pki.leaf("c1", { cnpj: CLIENTE_CNPJ, days: 300 });
    const r = await validateCertificateUpload({ file: Buffer.from(leaf.pem), role: "cliente", tenantId: "t1", tenantDocument: "00.000.000/0001-91" }, deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary).toMatchObject({ holderKind: "e-CNPJ", holderMasked: "**.000.000/****-**" });
    expect(JSON.stringify(r)).not.toContain(CLIENTE_CNPJ);
    expect(r.summary.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aceita também o .cer em DER", async () => {
    const leaf = pki.leaf("c2", { cnpj: CLIENTE_CNPJ });
    const r = await validateCertificateUpload({ file: leaf.x509.raw, role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ }, deps());
    expect(r.ok).toBe(true);
  });

  it("e-CNPJ de outra empresa é recusado", async () => {
    const leaf = pki.leaf("c3", { cnpj: "11222333000181" });
    const r = await validateCertificateUpload({ file: Buffer.from(leaf.pem), role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ }, deps());
    expect(r).toMatchObject({ ok: false });
    if (r.ok) return;
    expect(r.blockers.map((b) => b.code)).toContain("CLIENT_HOLDER_MISMATCH");
  });

  it("certificado bloqueado (impressão digital ou chave) é recusado", async () => {
    const leaf = pki.leaf("c4", { cnpj: CLIENTE_CNPJ });
    const repo = new InMemoryCertificateRegistry();
    const first = await validateCertificateUpload({ file: Buffer.from(leaf.pem), role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ }, deps(repo));
    if (!first.ok) throw new Error("deveria passar antes do bloqueio");
    (repo as unknown as { keyBlocklist: Set<string> }).keyBlocklist.add(first.summary.spki);
    const r = await validateCertificateUpload({ file: Buffer.from(leaf.pem), role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ }, deps(repo));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.blockers.map((b) => b.code)).toContain("CERT_BLOCKLISTED");
  });

  it("certificado da WJB emitido antes do incidente de 26/11 é recusado (o exposto fica inutilizado)", async () => {
    const leaf = pki.leaf("w-antigo", { cnpj: WJB_CNPJ, notBefore: "20260601000000Z", notAfter: "20270601000000Z" });
    const r = await validateCertificateUpload({ file: Buffer.from(leaf.pem), role: "wjb", tenantId: null }, deps());
    expect(r.ok).toBe(false);
  });

  it("sem cadeia ICP-Brasil nem revogação reais, nada passa fora dos testes", async () => {
    const leaf = pki.leaf("c5", { cnpj: CLIENTE_CNPJ });
    const r = await validateCertificateUpload(
      { file: Buffer.from(leaf.pem), role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ },
      { trust: null, revocation: null, repo: new InMemoryCertificateRegistry(), requireRealVerification: true },
    );
    expect(r.ok).toBe(false);
  });

  it("certificado de AC é recusado", async () => {
    const r = await validateCertificateUpload({ file: Buffer.from(pki.caPem), role: "cliente", tenantId: "t1", tenantDocument: CLIENTE_CNPJ }, deps());
    expect(r).toMatchObject({ ok: false, blockers: [{ code: "CERTIFICADO_DE_AC" }] });
  });
});
