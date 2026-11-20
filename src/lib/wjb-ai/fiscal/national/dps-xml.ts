import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";

/**
 * Montagem da DPS com os nomes de grupos/elementos do Anexo I v1.01
 * (LEIAUTE DPS_NFS-e). SÓ PARA O CONECTOR EM MODO SIMULADO e testes de
 * contrato: ainda NÃO foi validada contra o XSD v1.01 nem assinada
 * (XMLDSig). Pendências antes da homologação oficial (doc 24):
 * namespace e valor de `versao` (conferir no XSD), assinatura, grupo
 * IBSCBS completo.
 *
 * Nenhum campo tributário é inventado: tudo que é decisão fiscal vem de
 * `FiscalParameters`, preenchido e aprovado pelo contador no perfil fiscal.
 */
export const DPS_NAMESPACE_PENDENTE_CONFERENCIA =
  "http://www.sped.fazenda.gov.br/nfse";
export const DPS_LAYOUT_VERSION_PENDENTE_CONFERENCIA = "1.01";

/** Parâmetros que só o contador define (perfil fiscal aprovado). */
export interface FiscalParameters {
  cTribNac?: string; // código de tributação nacional, 6 dígitos (cServ/cTribNac)
  cLocPrestacao?: string; // IBGE do local da prestação (serv/locPrest)
  tribISSQN?: string; // tribMun/tribISSQN (domínio no Anexo I)
  tpRetISSQN?: string; // tribMun/tpRetISSQN
  opSimpNac?: string; // prest/regTrib/opSimpNac
  regEspTrib?: string; // prest/regTrib/regEspTrib
  indTotTrib?: string; // totTrib/indTotTrib (uma das escolhas do grupo totTrib)
  ibsCbs?: { informar: boolean }; // grupo IBSCBS: só com decisão expressa (doc 24)
}

export interface Emitter {
  municipalityIbge: string;
  documentKind: "CPF" | "CNPJ";
  document: string;
}

export class FiscalParametersMissingError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Parametrização fiscal incompleta no perfil aprovado: ${missing.join(", ")}.`,
    );
  }
}

const REQUIRED: (keyof FiscalParameters)[] = [
  "cTribNac",
  "cLocPrestacao",
  "tribISSQN",
  "tpRetISSQN",
  "opSimpNac",
  "regEspTrib",
  "indTotTrib",
];

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const tag = (name: string, value: string) => `<${name}>${esc(value)}</${name}>`;
const docTag = (kind: "CPF" | "CNPJ", doc: string) => tag(kind, doc);

export function buildDpsXml(input: {
  dpsId: string;
  environment: "producao" | "homologacao";
  series: number;
  number: number;
  issuedAt: string; // ISO com fuso
  emitter: Emitter;
  draft: NormalizedNfseDraft;
  params: FiscalParameters;
}): string {
  const p = input.params;
  const missing: string[] = REQUIRED.filter((k) => !p[k]);
  if (p.cTribNac && !/^\d{6}$/.test(p.cTribNac))
    missing.push("cTribNac (6 dígitos)");
  if (p.ibsCbs?.informar)
    missing.push(
      "IBSCBS (grupo completo ainda não implementado; decisão do contador pendente)",
    );
  if (missing.length) throw new FiscalParametersMissingError(missing);

  const d = input.draft;
  const valor = (d.amountCents / 100).toFixed(2);
  return [
    `<DPS xmlns="${DPS_NAMESPACE_PENDENTE_CONFERENCIA}" versao="${DPS_LAYOUT_VERSION_PENDENTE_CONFERENCIA}">`,
    `<infDPS Id="${esc(input.dpsId)}">`,
    tag("tpAmb", input.environment === "producao" ? "1" : "2"),
    tag("dhEmi", input.issuedAt),
    tag("verAplic", "WJB-AI-0.1"),
    tag("serie", String(input.series)),
    tag("nDPS", String(input.number)),
    tag("dCompet", `${d.competence}-01`),
    tag("tpEmit", "1"),
    tag("cLocEmi", input.emitter.municipalityIbge),
    `<prest>${docTag(input.emitter.documentKind, input.emitter.document)}<regTrib>${tag("opSimpNac", p.opSimpNac!)}${tag("regEspTrib", p.regEspTrib!)}</regTrib></prest>`,
    `<toma>${docTag(d.taker.documentKind, d.taker.document)}${tag("xNome", d.taker.name)}${d.taker.email ? tag("email", d.taker.email) : ""}</toma>`,
    `<serv><locPrest>${tag("cLocPrestacao", p.cLocPrestacao!)}</locPrest><cServ>${tag("cTribNac", p.cTribNac!)}${tag("xDescServ", d.serviceDescription)}</cServ></serv>`,
    `<valores><vServPrest>${tag("vServ", valor)}</vServPrest><trib><tribMun>${tag("tribISSQN", p.tribISSQN!)}${tag("tpRetISSQN", p.tpRetISSQN!)}</tribMun><totTrib>${tag("indTotTrib", p.indTotTrib!)}</totTrib></trib></valores>`,
    `</infDPS>`,
    `</DPS>`,
  ].join("");
}
