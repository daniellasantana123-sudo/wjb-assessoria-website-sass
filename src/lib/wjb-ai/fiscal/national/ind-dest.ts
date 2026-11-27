/**
 * Indicador do destinatário do serviço (`indDest`), Fase 10C (26/11/2026).
 *
 * Fonte: XSD oficial da NT 009 release 2 (24/11/2026), tipo `TSRTCIndDest`:
 *   0 - o destinatário é o próprio tomador/adquirente identificado na NFS-e
 *       (tomador = adquirente = destinatário);
 *   1 - o destinatário não é o próprio adquirente: outra pessoa física ou
 *       jurídica (ou equiparada) ou um estabelecimento diferente do tomador
 *       (tomador = adquirente ≠ destinatário). Nesse caso o grupo `dest`
 *       (TCRTCInfoDest) descreve o destinatário.
 *
 * Regra da plataforma: nunca presumir. O 0 só é usado quando o pedido
 * DECLARA que o destinatário é o próprio tomador. Destinatário diferente
 * exige o grupo `dest`, que a plataforma ainda não coleta: vai para o
 * contador, sem caminho automático. Pedido sem a informação também vai para
 * o contador. A regra aguarda validação do responsável contábil da WJB
 * (docs/wjb-ai/fase-10c/07_VALIDACAO_NFSE.md).
 */
export type IndDestDecision =
  | { ok: true; value: "0" }
  | { ok: false; code: "INDDEST_NAO_INFORMADO" | "INDDEST_DESTINATARIO_DIFERENTE"; message: string };

export function resolveIndDest(recipientIsTaker: boolean | undefined): IndDestDecision {
  if (recipientIsTaker === true) return { ok: true, value: "0" };
  if (recipientIsTaker === false)
    return {
      ok: false,
      code: "INDDEST_DESTINATARIO_DIFERENTE",
      message:
        "destinatário diferente do tomador (indDest=1 exige o grupo dest, não coletado): encaminhar ao contador",
    };
  return {
    ok: false,
    code: "INDDEST_NAO_INFORMADO",
    message: "destinatário do serviço não informado (indDest): confirmar com o contador",
  };
}

/** Texto para telas (Portal e Admin). */
export function recipientLabel(recipientIsTaker: boolean | undefined): string {
  if (recipientIsTaker === true) return "O próprio tomador";
  if (recipientIsTaker === false) return "Outra pessoa ou estabelecimento (revisão do contador)";
  return "Não informado (o contador confirma)";
}
