import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import {
  isApiSeries,
  type LayoutContract,
} from "@/lib/wjb-ai/fiscal/national/layouts";
import { resolveIndDest } from "@/lib/wjb-ai/fiscal/national/ind-dest";

/**
 * Montagem da DPS (TCInfDPS) com a ordem e os tipos dos XSD oficiais
 * (docs/wjb-ai/oficial/xsd). Validada nos testes de contrato com xmllint
 * contra os dois pacotes vigentes. Ainda SEM assinatura ICP-Brasil: a
 * assinatura é um passo separado (signing.ts) e a real não existe nesta fase.
 *
 * Nenhum campo tributário é inventado: tudo que é decisão fiscal vem de
 * `FiscalParameters`, preenchido e aprovado pelo contador no perfil fiscal.
 */

/** Parâmetros que só o contador define (perfil fiscal aprovado). */
export interface FiscalParameters {
  cTribNac?: string; // TSCodTribNac: 6 dígitos
  cLocPrestacao?: string; // TSCodMunIBGE: 7 dígitos
  tribISSQN?: string; // TSTribISSQN: 1-4
  tpRetISSQN?: string; // TSTipoRetISSQN: 1-3
  opSimpNac?: string; // TSOpSimpNac: 1-3
  regEspTrib?: string; // TSRegEspTrib: 0-6, 9
  indTotTrib?: string; // TSTipoIndTotTrib: 0
  regApTribSN?: string; // TSRegimeApuracaoSimpNac: 1-3, só ME/EPP
  pAliq?: string; // TSDec1V2: alíquota do ISSQN quando a regra oficial exige
  ibsCbs?: { informar: boolean }; // grupo IBSCBS: só com decisão expressa
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

/** Domínios dos XSD v1.01 (iguais nos dois pacotes vigentes). */
export const FISCAL_DOMAINS = {
  cTribNac: /^\d{6}$/,
  cLocPrestacao: /^\d{7}$/,
  tribISSQN: /^[1-4]$/,
  tpRetISSQN: /^[1-3]$/,
  opSimpNac: /^[1-3]$/,
  regEspTrib: /^[0-69]$/,
  indTotTrib: /^0$/,
} as const satisfies Record<string, RegExp>;

export function missingFiscalParameters(p: FiscalParameters): string[] {
  const missing: string[] = [];
  for (const [k, re] of Object.entries(FISCAL_DOMAINS)) {
    const v = p[k as keyof typeof FISCAL_DOMAINS];
    if (!v) missing.push(k);
    else if (!re.test(v)) missing.push(`${k} (valor fora do domínio oficial)`);
  }
  if (p.regApTribSN && !/^[1-3]$/.test(p.regApTribSN))
    missing.push("regApTribSN (fora do domínio oficial)");
  if (p.pAliq && !/^(0|[0-9](\.[0-9]{2})?)$/.test(p.pAliq))
    missing.push("pAliq (formato oficial 0.00)");
  if (p.ibsCbs?.informar)
    missing.push(
      "IBSCBS (grupo completo ainda não implementado; decisão do contador pendente)",
    );
  return missing;
}

/**
 * TSDateTimeUTC: AAAA-MM-DDThh:mm:ss±hh:00, SEM milissegundos e sem "Z".
 * `toISOString()` gera "...000Z", que o XSD recusa (achado da Fase 5).
 * Usa o horário de Brasília (UTC-03:00; sem horário de verão desde 2019).
 */
export function formatDhEmi(date: Date): string {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 19) + "-03:00";
}

// Caracteres proibidos no XML 1.0 (controle exceto tab/LF/CR, U+FFFE/FFFF e
// substitutos isolados) gerariam XML inválido: são removidos (revisão B7).
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function esc(v: string): string {
  return v
    .replace(XML_INVALID, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const tag = (name: string, value: string) => `<${name}>${esc(value)}</${name}>`;
export const escapeXml = esc;

/** TSCodJustSubst (XSD oficial): motivo da substituição de NFS-e. */
export const SUBSTITUTION_REASONS = {
  "01": "Desenquadramento de NFS-e do Simples Nacional",
  "02": "Enquadramento de NFS-e no Simples Nacional",
  "03": "Inclusão Retroativa de Imunidade/Isenção para NFS-e",
  "04": "Exclusão Retroativa de Imunidade/Isenção para NFS-e",
  "05": "Rejeição de NFS-e pelo tomador ou pelo intermediário se responsável pelo recolhimento do tributo",
  "99": "Outros",
} as const;
export type SubstitutionReason = keyof typeof SUBSTITUTION_REASONS;
export interface DpsSubstitution {
  /** Chave de acesso da NFS-e substituída (TSChaveNFSe). */
  accessKey: string;
  reason: SubstitutionReason;
  /** TSMotivo, opcional no XSD: 15 a 255 caracteres. */
  description?: string;
}

export function buildDpsXml(input: {
  dpsId: string;
  layout: LayoutContract;
  environment: "producao" | "producao_restrita";
  series: number;
  number: number;
  issuedAt: Date;
  emitter: Emitter;
  draft: NormalizedNfseDraft;
  params: FiscalParameters;
  /** Identificação do aplicativo (TSVerAplic, 1-20). */
  appVersion?: string;
  /** Fase 10C: grupo `subst` (DPS que substitui uma NFS-e). */
  substitution?: DpsSubstitution;
}): string {
  const p = input.params;
  const missing = missingFiscalParameters(p);
  // Fase 10C: `indDest` nunca é presumido (ind-dest.ts).
  const indDest = input.layout.rules.indDestInInfDps
    ? resolveIndDest(input.draft.recipientIsTaker)
    : null;
  if (indDest && !indDest.ok) missing.push(indDest.message);
  const sub = input.substitution;
  if (sub) {
    if (!/^[0-9]{6}[0-9A-Z]{14}[0-9]{30}$/.test(sub.accessKey))
      missing.push("chave da NFS-e substituída fora do padrão oficial");
    if (!(sub.reason in SUBSTITUTION_REASONS)) missing.push("motivo da substituição fora da tabela oficial");
    const d = sub.description?.trim();
    if (d !== undefined && (d.length < 15 || d.length > 255))
      missing.push("descrição da substituição precisa ter de 15 a 255 caracteres");
  }
  if (!isApiSeries(input.series, input.layout))
    missing.push("série da DPS fora da faixa do canal API (00001-49999)");
  if (missing.length) throw new FiscalParametersMissingError(missing);

  const d = input.draft;
  const valor = (d.amountCents / 100).toFixed(2);
  return [
    // Manual Integrado 6.1.1 e Anexo I (E1229): declaração única com UTF-8.
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<DPS xmlns="${input.layout.namespace}" versao="${input.layout.dpsVersion}">`,
    `<infDPS Id="${esc(input.dpsId)}">`,
    tag("tpAmb", input.environment === "producao" ? "1" : "2"),
    tag("dhEmi", formatDhEmi(input.issuedAt)),
    tag("verAplic", (input.appVersion ?? "WJB-AI-0.1").slice(0, 20)),
    tag("serie", String(input.series).padStart(5, "0")),
    tag("nDPS", String(input.number)),
    tag("dCompet", `${d.competence}-01`),
    tag("tpEmit", "1"),
    // NT 009: finNFSe passou a ser obrigatório em infDPS. Domínio oficial de
    // um valor só (0 = NFS-e regular): não é decisão tributária.
    input.layout.rules.finNFSeLocation === "infDPS" ? tag("finNFSe", "0") : "",
    tag("cLocEmi", input.emitter.municipalityIbge),
    sub
      ? `<subst>${tag("chSubstda", sub.accessKey)}${tag("cMotivo", sub.reason)}${sub.description?.trim() ? tag("xMotivo", sub.description.trim()) : ""}</subst>`
      : "",
    `<prest>${tag(input.emitter.documentKind, input.emitter.document)}<regTrib>${tag("opSimpNac", p.opSimpNac!)}${p.regApTribSN ? tag("regApTribSN", p.regApTribSN) : ""}${tag("regEspTrib", p.regEspTrib!)}</regTrib></prest>`,
    `<toma>${tag(d.taker.documentKind, d.taker.document)}${tag("xNome", d.taker.name)}${d.taker.email ? tag("email", d.taker.email) : ""}</toma>`,
    // NT 009 release 2 (24/11/2026): `indDest` obrigatório em infDPS, logo
    // depois do tomador. Só sai 0 quando o pedido declara que o destinatário
    // é o próprio tomador (Fase 10C, ind-dest.ts); qualquer outro caso já
    // foi recusado acima.
    indDest?.ok ? tag("indDest", indDest.value) : "",
    `<serv><locPrest>${tag("cLocPrestacao", p.cLocPrestacao!)}</locPrest><cServ>${tag("cTribNac", p.cTribNac!)}${tag("xDescServ", d.serviceDescription)}</cServ></serv>`,
    `<valores><vServPrest>${tag("vServ", valor)}</vServPrest><trib><tribMun>${tag("tribISSQN", p.tribISSQN!)}${tag("tpRetISSQN", p.tpRetISSQN!)}${p.pAliq ? tag("pAliq", p.pAliq) : ""}</tribMun><totTrib>${tag("indTotTrib", p.indTotTrib!)}</totTrib></trib></valores>`,
    `</infDPS>`,
    `</DPS>`,
  ].join("");
}
