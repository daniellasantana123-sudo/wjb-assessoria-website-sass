import { X509Certificate } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readCertificateSignatureAlgorithm } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import { createTestPki, opensslAvailable, type TestPki } from "@/tests/helpers/test-pki";
import { isKnownOfficialXsdIssue } from "@/tests/helpers/xsd-known-issues";

/**
 * Fase 10D: diferenças entre ambientes achadas na CI em Linux (Node 22,
 * libxml2 do Ubuntu) que não aparecem no macOS com Node 24.
 */
describe.skipIf(!opensslAvailable)("algoritmo de assinatura do certificado lido do DER (Node 20/22/24)", () => {
  let pki: TestPki;
  beforeAll(() => {
    pki = createTestPki();
  });
  afterAll(() => pki?.dispose());
  it("SHA-256 e SHA-1 reconhecidos; igual ao Node quando ele expõe a propriedade", () => {
    const a = pki.leaf("alg-256", { cnpj: "11222333000181", digest: "sha256" }).x509;
    const b = pki.leaf("alg-1", { cnpj: "11222333000181", digest: "sha1" }).x509;
    expect(readCertificateSignatureAlgorithm(a.raw)).toBe("sha256WithRSAEncryption");
    expect(readCertificateSignatureAlgorithm(b.raw)).toBe("sha1WithRSAEncryption");
    const node = (x: X509Certificate) => (x as X509Certificate & { signatureAlgorithm?: string }).signatureAlgorithm;
    if (node(a)) expect(node(a)).toBe(readCertificateSignatureAlgorithm(a.raw));
    if (node(b)) expect(node(b)).toBe(readCertificateSignatureAlgorithm(b.raw));
  });
  it("DER ilegível devolve null (a política então recusa)", () => {
    expect(readCertificateSignatureAlgorithm(Buffer.from([0x30, 0x03, 0x02, 0x01]))).toBeNull();
  });
});

describe("erro conhecido do XSD oficial de produção: só ele é tolerado", () => {
  const mac = "dps.xml:1: element serie: Schemas validity error : Element '{http://www.sped.fazenda.gov.br/nfse}serie': [facet 'pattern'] The value '00001' is not accepted by the pattern '^0{0,4}\\d{1,5}$'.";
  const ubuntu = "/tmp/x/dps.xml:1: Schemas validity error : Element '{http://www.sped.fazenda.gov.br/nfse}serie': [facet 'pattern'] The value '00001' is not accepted by the pattern '^0{0,4}\\d{1,5}$'.";
  it("nos dois formatos de mensagem, só no pacote de produção", () => {
    expect(isKnownOfficialXsdIssue("producao-v1.01-20260209", mac)).toBe(true);
    expect(isKnownOfficialXsdIssue("producao-v1.01-20260209", ubuntu)).toBe(true);
    expect(isKnownOfficialXsdIssue("producao-restrita-nt009-r2-20261124", ubuntu)).toBe(false);
  });
  it("outro erro em serie ou em outro campo NÃO é tolerado", () => {
    expect(isKnownOfficialXsdIssue("producao-v1.01-20260209", ubuntu.replace("^0{0,4}\\d{1,5}$", "[0-9]{1,4}|[0-8][0-9]{4}"))).toBe(false);
    expect(isKnownOfficialXsdIssue("producao-v1.01-20260209", "Element '{http://www.sped.fazenda.gov.br/nfse}nDPS': [facet 'pattern'] ...")).toBe(false);
  });
});
