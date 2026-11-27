import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildDpsId } from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  formatDhEmi,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  LAYOUT_CONTRACTS,
  type LayoutContract,
} from "@/lib/wjb-ai/fiscal/national/layouts";
import { SimulatedDpsSigner } from "@/lib/wjb-ai/fiscal/national/signing";

/**
 * Teste de contrato contra os XSD OFICIAIS (docs/wjb-ai/oficial/xsd).
 * Prova que o XML que o conector monta é aceito pelo esquema de cada
 * ambiente. NÃO prova aceitação pela SEFIN: regras de negócio, assinatura
 * real e cadastro só são conferidos na produção restrita.
 */
const hasXmllint =
  spawnSync("xmllint", ["--version"], { stdio: "ignore" }).status === 0;

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
  opSimpNac: "3",
  regEspTrib: "0",
  indTotTrib: "0",
};
const draft = {
  serviceDescription: "Consultoria fictícia & teste",
  // Fase 10C: indDest declarado (destinatário = tomador); nunca presumido.
  recipientIsTaker: true,
  amountCents: 123456,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF" as const,
    name: "Tomador Fictício",
    email: "tomador@exemplo.test",
  },
};

/**
 * Defeito conhecido no XSD OFICIAL de produção v1.01 (09/02/2026): o padrão
 * de TSSerieDPS é `^0{0,4}\d{1,5}$`. Em XSD, `^` e `$` são caracteres
 * literais (W3C XML Schema, apêndice F), então validadores que seguem a norma
 * (libxml2) recusam qualquer série. O pacote de produção restrita corrigiu
 * para `[0-9]{1,4}|[0-8][0-9]{4}`. Só ESTE erro é tolerado, e só nesse pacote.
 */
const KNOWN_OFFICIAL_XSD_ISSUES: Record<string, RegExp[]> = {
  "producao-v1.01-20260209": [
    /element serie: Schemas validity error .*\[facet 'pattern'\] The value '\d+' is not accepted by the pattern '\^0\{0,4\}\\d\{1,5\}\$'/,
  ],
};

function validate(layout: LayoutContract, xml: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-dps-"));
  const file = path.join(dir, "dps.xml");
  writeFileSync(file, xml);
  const r = spawnSync(
    "xmllint",
    [
      "--noout",
      "--schema",
      path.join(process.cwd(), layout.xsdDir, "DPS_v1.01.xsd"),
      file,
    ],
    { encoding: "utf8" },
  );
  const output = `${r.stdout}${r.stderr}`;
  const errors = output
    .split("\n")
    .filter((l) => l.includes("validity error"))
    .filter(
      (l) =>
        !(KNOWN_OFFICIAL_XSD_ISSUES[layout.id] ?? []).some((re) => re.test(l)),
    );
  return {
    ok:
      r.status === 0 ||
      (errors.length === 0 &&
        /fails to validate/.test(output) &&
        output.includes("validity error")),
    errors,
    output,
  };
}

async function signedDps(layout: LayoutContract, overrides = {}) {
  const series = 1;
  const number = 987654;
  const dpsId = buildDpsId({ ...emitter, series, number }, layout);
  const xml = buildDpsXml({
    dpsId,
    layout,
    environment: "producao_restrita",
    series,
    number,
    issuedAt: new Date("2026-11-20T15:04:05.123Z"),
    emitter,
    draft,
    params,
    ...overrides,
  });
  return new SimulatedDpsSigner().sign(xml, dpsId);
}

describe("formato de data e hora da DPS (TSDateTimeUTC)", () => {
  it("sem milissegundos, sem Z, com -03:00", () => {
    expect(formatDhEmi(new Date("2026-11-20T15:04:05.123Z"))).toBe(
      "2026-11-20T12:04:05-03:00",
    );
  });
});

describe.skipIf(!hasXmllint)("DPS gerada x XSD oficial", () => {
  for (const layout of LAYOUT_CONTRACTS) {
    it(`assinada, é válida no esquema ${layout.id}`, async () => {
      const r = validate(layout, await signedDps(layout));
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }

  it("o formato antigo de data (toISOString) seria recusado pelo esquema", async () => {
    const layout = LAYOUT_CONTRACTS[0];
    const xml = (await signedDps(layout)).replace(
      /<dhEmi>[^<]+<\/dhEmi>/,
      "<dhEmi>2026-11-20T15:04:05.123Z</dhEmi>",
    );
    expect(validate(layout, xml).ok).toBe(false);
  });

  it("valor fora do domínio oficial é recusado pelo esquema (prova de que a validação funciona)", async () => {
    const layout = LAYOUT_CONTRACTS[0];
    const xml = (await signedDps(layout)).replace(
      "<tribISSQN>1</tribISSQN>",
      "<tribISSQN>9</tribISSQN>",
    );
    expect(validate(layout, xml).ok).toBe(false);
  });

  it("série 90000 é aceita no esquema de produção mas recusada no de produção restrita", () => {
    for (const layout of LAYOUT_CONTRACTS) {
      const xml = execFileSync("cat", [
        path.join(process.cwd(), layout.xsdDir, "tiposSimples_v1.01.xsd"),
      ]).toString();
      const pattern = xml.match(
        /name="TSSerieDPS"[\s\S]*?pattern value="([^"]+)"/,
      )![1];
      const re = new RegExp(`^(?:${pattern.replace(/^\^|\$$/g, "")})$`);
      expect(re.test("90000")).toBe(layout.rules.seriesMax >= 90000);
    }
  });
});
