import { execFileSync, spawnSync } from "node:child_process";
import { createHash, createPrivateKey, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import { buildDpsId } from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  LAYOUT_CONTRACTS,
  resolveLayout,
} from "@/lib/wjb-ai/fiscal/national/layouts";
import { canonicalize, parseXml } from "@/lib/wjb-ai/fiscal/national/xml-c14n";
import {
  DSIG_NS,
  signXml,
  verifyXmlSignature,
  type SigningMaterial,
} from "@/lib/wjb-ai/fiscal/national/xmldsig";
import { isKnownOfficialXsdIssue } from "@/tests/helpers/xsd-known-issues";

/**
 * Assinatura XMLDSig REAL, com certificado de TESTE gerado na hora:
 * autoassinado, NÃO ICP-Brasil, CNPJ fictício, apagado no fim. Prova a
 * criptografia e o formato; não prova aceitação pela SEFIN (cadeia ICP-Brasil
 * e LCR só existem com certificado legítimo).
 *
 * A verificação INDEPENDENTE usa libxml2 (`xmllint --c14n`) para canonicalizar
 * e OpenSSL para conferir digest e assinatura RSA, sem passar pelo nosso código.
 */
const tools =
  spawnSync("openssl", ["version"], { stdio: "ignore" }).status === 0 &&
  spawnSync("xmllint", ["--version"], { stdio: "ignore" }).status === 0;

const CNPJ = "00000000000191"; // fictício
const NS = "http://www.sped.fazenda.gov.br/nfse";
let dir = "";
let material: SigningMaterial;
let certPem = "";

beforeAll(() => {
  if (!tools) return;
  dir = mkdtempSync(path.join(tmpdir(), "wjb-sig-"));
  writeFileSync(
    path.join(dir, "ext.cnf"),
    `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=EMPRESA FICTICIA TESTE:${CNPJ}\nO=TESTE NAO ICP-BRASIL\n[ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation,keyEncipherment\nextendedKeyUsage=clientAuth\nsubjectAltName=otherName:2.16.76.1.3.3;OCTETSTRING:${CNPJ}\n`,
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      "key.pem",
      "-out",
      "cert.pem",
      "-days",
      "30",
      "-config",
      "ext.cnf",
      "-extensions",
      "ext",
    ],
    { cwd: dir, stdio: "ignore" },
  );
  certPem = readFileSync(path.join(dir, "cert.pem"), "utf8");
  material = {
    privateKey: createPrivateKey(readFileSync(path.join(dir, "key.pem"))),
    certificateDer: new X509Certificate(certPem).raw,
  };
});
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const params: FiscalParameters = {
  cTribNac: "010101",
  cLocPrestacao: "3550308",
  tribISSQN: "1",
  tpRetISSQN: "1",
  opSimpNac: "3",
  regEspTrib: "0",
  indTotTrib: "0",
};
function dps(layoutIdx = 0) {
  const layout = LAYOUT_CONTRACTS[layoutIdx];
  const emitter = {
    municipalityIbge: "3550308",
    documentKind: "CNPJ" as const,
    document: CNPJ,
  };
  const id = buildDpsId({ ...emitter, series: 1, number: 31 }, layout);
  const xml = buildDpsXml({
    dpsId: id,
    layout,
    environment: "producao_restrita",
    series: 1,
    number: 31,
    issuedAt: new Date("2026-11-20T15:00:00Z"),
    emitter,
    draft: {
      serviceDescription: `Serviço "fictício" & teste <ok> ção`,
      amountCents: 12345,
      competence: "2026-11",
      taker: {
        document: "52998224725",
        documentKind: "CPF",
        name: "Tomador D'Ávila Fictício",
      },
    },
    params,
  });
  return { id, xml, layout };
}

function sh(cmd: string, args: string[], input?: string) {
  return execFileSync(cmd, args, { cwd: dir, input, encoding: "buffer" });
}

describe.skipIf(!tools)(
  "certificado: leitura dos requisitos do Sistema Nacional",
  () => {
    it("lê CNPJ do OtherName 2.16.76.1.3.3, uso de chave, autenticação de cliente e versão 3", () => {
      const m = inspectCertificate(certPem, "vault://teste/ficticio");
      expect(m).toMatchObject({
        holderDocument: CNPJ,
        icpBrasilV3: true,
        keyUsageDigitalSignature: true,
        keyUsageNonRepudiation: true,
        clientAuth: true,
        isCa: false,
      });
      expect(m.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    });
  },
);

describe.skipIf(!tools)("assinatura XMLDSig real da DPS", () => {
  it("C14N igual ao libxml2, byte a byte (com acentos, aspas, & e <)", () => {
    const { xml } = dps();
    const inf = xml
      .match(/<infDPS[\s\S]*<\/infDPS>/)![0]
      .replace("<infDPS ", `<infDPS xmlns="${NS}" `);
    writeFileSync(path.join(dir, "inf.xml"), inf);
    const libxml = sh("xmllint", ["--c14n", "inf.xml"]).toString("utf8");
    const ours = canonicalize(
      parseXml(xml).children.find((c) => c.type === "element") as never,
    );
    expect(ours).toBe(libxml);
  });

  for (const idx of [0, 1]) {
    it(`assinada (RSA-SHA1) é verificada pelo OpenSSL e válida no XSD ${LAYOUT_CONTRACTS[idx].id}`, () => {
      const { id, xml, layout } = dps(idx);
      const signed = signXml(xml, id, material);
      // 1) Estrutura conforme o Manual Integrado.
      expect(signed).toMatch(
        new RegExp(
          `</infDPS><Signature xmlns="${DSIG_NS.replace(/[.#]/g, "\\$&")}">`,
        ),
      );
      expect(signed).toContain(`<Reference URI="#${id}">`);
      expect(signed).toContain("xmldsig#rsa-sha1");
      expect(signed).not.toMatch(/X509SubjectName|X509IssuerSerial|KeyValue/);
      // 2) Digest independente: libxml2 C14N + SHA-1.
      const inf = signed
        .match(/<infDPS[\s\S]*<\/infDPS>/)![0]
        .replace("<infDPS ", `<infDPS xmlns="${NS}" `);
      writeFileSync(path.join(dir, "inf.xml"), inf);
      const c14n = sh("xmllint", ["--c14n", "inf.xml"]);
      const digest = createHash("sha1").update(c14n).digest("base64");
      expect(signed).toContain(`<DigestValue>${digest}</DigestValue>`);
      // 3) Assinatura independente: libxml2 C14N do SignedInfo + OpenSSL.
      const si = signed
        .match(/<SignedInfo>[\s\S]*<\/SignedInfo>/)![0]
        .replace("<SignedInfo>", `<SignedInfo xmlns="${DSIG_NS}">`);
      writeFileSync(path.join(dir, "si.xml"), si);
      writeFileSync(
        path.join(dir, "si.c14n"),
        sh("xmllint", ["--c14n", "si.xml"]),
      );
      writeFileSync(
        path.join(dir, "sig.bin"),
        Buffer.from(signed.match(/<SignatureValue>([^<]+)/)![1], "base64"),
      );
      writeFileSync(
        path.join(dir, "pub.pem"),
        sh("openssl", ["x509", "-pubkey", "-noout", "-in", "cert.pem"]),
      );
      const out = spawnSync(
        "openssl",
        [
          "dgst",
          "-sha1",
          "-verify",
          "pub.pem",
          "-signature",
          "sig.bin",
          "si.c14n",
        ],
        { cwd: dir, encoding: "utf8" },
      );
      expect(out.stdout).toContain("Verified OK");
      // 4) Nosso verificador concorda.
      expect(verifyXmlSignature(signed)).toMatchObject({
        valid: true,
        profile: "rsa-sha1",
      });
      // 5) XSD oficial com a assinatura real.
      writeFileSync(path.join(dir, "dps.xml"), signed);
      const x = spawnSync(
        "xmllint",
        [
          "--noout",
          "--schema",
          path.join(process.cwd(), layout.xsdDir, "DPS_v1.01.xsd"),
          "dps.xml",
        ],
        { cwd: dir, encoding: "utf8" },
      );
      const errors = `${x.stdout}${x.stderr}`
        .split("\n")
        .filter(
          (l) => l.includes("validity error") && !isKnownOfficialXsdIssue(layout.id, l),
        );
      expect(errors).toEqual([]);
    });
  }

  it("conteúdo alterado depois de assinar é recusado (E0714)", () => {
    const { id, xml } = dps();
    const signed = signXml(xml, id, material);
    expect(
      verifyXmlSignature(
        signed.replace("<vServ>123.45</vServ>", "<vServ>999.99</vServ>"),
      ),
    ).toMatchObject({ valid: false, code: "E0714" });
  });

  it("SignedInfo alterado (troca de algoritmo) é recusado", () => {
    const { id, xml } = dps();
    const signed = signXml(xml, id, material);
    expect(
      verifyXmlSignature(signed.replace("xmldsig#sha1", "xmlenc#sha256")).valid,
    ).toBe(false);
  });

  it("assinatura de outro certificado não confere", () => {
    const { id, xml } = dps();
    const signed = signXml(xml, id, material);
    const other = execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        "/dev/null",
        "-subj",
        "/CN=OUTRO FICTICIO",
        "-days",
        "1",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const otherDer = new X509Certificate(other).raw.toString("base64");
    const swapped = signed.replace(
      /<X509Certificate>[^<]+</,
      `<X509Certificate>${otherDer}<`,
    );
    expect(verifyXmlSignature(swapped)).toMatchObject({
      valid: false,
      code: "E0714",
    });
  });

  it("sem assinatura = E0717; KeyInfo com KeyValue é recusado", () => {
    const { id, xml } = dps();
    expect(verifyXmlSignature(xml)).toMatchObject({
      valid: false,
      code: "E0717",
    });
    const signed = signXml(xml, id, material);
    expect(
      verifyXmlSignature(
        signed.replace("<X509Data>", "<KeyValue></KeyValue><X509Data>"),
      ).valid,
    ).toBe(false);
  });

  it("SHA-256 só como opção explícita e também verificável", () => {
    const { id, xml } = dps(1);
    const signed = signXml(xml, id, material, "rsa-sha256");
    expect(verifyXmlSignature(signed)).toMatchObject({
      valid: true,
      profile: "rsa-sha256",
    });
    expect(resolveLayout("producao_restrita", "2026-11-20").id).toBe(
      LAYOUT_CONTRACTS[1].id,
    );
  });

  it("prefixo de namespace é recusado (E1228)", () => {
    expect(() => parseXml(`<n:DPS xmlns:n="${NS}"></n:DPS>`)).toThrow(
      /Prefixo/,
    );
  });
});
