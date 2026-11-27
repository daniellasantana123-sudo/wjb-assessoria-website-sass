import { escapeXml, formatDhEmi } from "@/lib/wjb-ai/fiscal/national/dps-xml";
import { NFSE_NAMESPACE } from "@/lib/wjb-ai/fiscal/national/layouts";

/**
 * Pedido de registro de evento da NFS-e (Fase 10C, 26/11/2026): só o
 * CANCELAMENTO pelo emitente (e101101), montado a partir do XSD oficial de
 * produção restrita da NT 009 release 2 (`pedRegEvento_v1.01.xsd` +
 * `tiposEventos_v1.01.xsd`, pacote de 24/11/2026) e validado com xmllint.
 *
 * O que NÃO existe aqui, de propósito:
 * - envio: o caminho da API de eventos não está em documento público lido
 *   (só no swagger autenticado). O contrato marca como pendente e o portão
 *   de transmissão continua fechado;
 * - assinatura: o algoritmo oficial vigente não está confirmado;
 * - produção: só tpAmb = 2 (produção restrita);
 * - cancelamento por substituição (e105102): o XSD o descreve, mas nenhum
 *   documento lido diz se é o emitente quem o envia ou se a SEFIN o gera ao
 *   autorizar a DPS substituta. Fica pendente (doc 07 da Fase 10C).
 *
 * Divergência do próprio XSD: a documentação de TSIdPedRegEvt fala em
 * "PRE" + chave (50) + tipo do evento (6) + nPedRegEvento (3) = 62
 * posições, mas o mesmo tipo limita a 59 e o padrão só aceita 59 (sem
 * nPedRegEvento, que nem existe no grupo infPedReg). Seguimos o que o
 * validador aplica (59) e registramos a divergência.
 */
export const CANCELLATION_EVENT = "101101";
export const ACCESS_KEY_PATTERN = /^[0-9]{6}[0-9A-Z]{14}[0-9]{30}$/;
/** TSCodJustCanc. */
export const CANCELLATION_REASONS = {
  "1": "Erro na Emissão",
  "2": "Serviço não Prestado",
  "9": "Outros",
} as const;
export type CancellationReason = keyof typeof CANCELLATION_REASONS;

export class EventInputError extends Error {
  constructor(readonly issues: string[]) {
    super(`Pedido de evento inválido: ${issues.join("; ")}.`);
    this.name = "EventInputError";
  }
}

export function buildPedRegEventoId(accessKey: string, eventCode: string): string {
  return `PRE${accessKey}${eventCode}`;
}

export function buildCancellationRequestXml(input: {
  environment: "producao_restrita";
  accessKey: string;
  author: { kind: "CNPJ" | "CPF"; document: string };
  reason: CancellationReason;
  /** TSMotivo: 15 a 255 caracteres. */
  description: string;
  at: Date;
  appVersion?: string;
}): string {
  const issues: string[] = [];
  if (input.environment !== "producao_restrita") issues.push("só produção restrita nesta fase");
  if (!ACCESS_KEY_PATTERN.test(input.accessKey)) issues.push("chave de acesso fora do padrão oficial");
  // O Id do pedido exige 1 (CPF) ou 2 (CNPJ) na posição do tipo de inscrição.
  if (!/^[0-9]{8}[12]/.test(input.accessKey)) issues.push("chave de acesso sem tipo de inscrição válido");
  const doc = input.author.document.replace(/\D/g, "");
  if (input.author.kind === "CNPJ" ? !/^\d{14}$/.test(doc) : !/^\d{11}$/.test(doc))
    issues.push("documento do autor inválido");
  if (!(input.reason in CANCELLATION_REASONS)) issues.push("motivo fora da tabela oficial");
  const text = input.description.trim();
  if (text.length < 15 || text.length > 255) issues.push("descrição do motivo precisa ter de 15 a 255 caracteres");
  if (issues.length) throw new EventInputError(issues);

  const t = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<pedRegEvento xmlns="${NFSE_NAMESPACE}" versao="1.01">`,
    `<infPedReg Id="${buildPedRegEventoId(input.accessKey, CANCELLATION_EVENT)}">`,
    t("tpAmb", "2"),
    t("verAplic", (input.appVersion ?? "WJB-AI-0.1").slice(0, 20)),
    t("dhEvento", formatDhEmi(input.at)),
    t(input.author.kind === "CNPJ" ? "CNPJAutor" : "CPFAutor", doc),
    t("chNFSe", input.accessKey),
    `<e${CANCELLATION_EVENT}>`,
    t("xDesc", "Cancelamento de NFS-e"),
    t("cMotivo", input.reason),
    t("xMotivo", text),
    `</e${CANCELLATION_EVENT}>`,
    `</infPedReg>`,
    `</pedRegEvento>`,
  ].join("");
}
