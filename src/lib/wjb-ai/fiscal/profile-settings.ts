import { z } from "zod";

import type { EmitterAuthorization } from "@/lib/wjb-ai/fiscal/emitter-authorization";
import {
  FISCAL_DOMAINS,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  checkRegimeAndAliquota,
  formatAliquota,
} from "@/lib/wjb-ai/fiscal/aliquota-rules";
import {
  isApiSeries,
  type LayoutContract,
} from "@/lib/wjb-ai/fiscal/national/layouts";

/**
 * Cadastro fiscal da empresa (Fase 5): parâmetros que o CONTADOR define e
 * aprova, guardados em `fiscal_profiles.service_settings` (jsonb já existente
 * na 0024, versionado e imutável depois de aprovado). A IA nunca preenche
 * nada disto: o schema é estrito e só a ação de cadastro do Admin grava.
 *
 * Domínios conferidos nos XSD oficiais v1.01 (docs/wjb-ai/oficial/xsd).
 */
export const ENQUADRAMENTOS = {
  MEI: "MEI",
  SIMPLES_ME_EPP: "Simples Nacional (ME/EPP)",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  AUTONOMO: "Profissional autônomo (CPF)",
} as const;
export type Enquadramento = keyof typeof ENQUADRAMENTOS;

/** Situação perante o Simples exigida pelo enquadramento (TSOpSimpNac). */
export const OP_SIMP_NAC_BY_ENQUADRAMENTO: Record<Enquadramento, string> = {
  MEI: "2",
  SIMPLES_ME_EPP: "3",
  LUCRO_PRESUMIDO: "1",
  LUCRO_REAL: "1",
  AUTONOMO: "1",
};

const digits = (n: number) => new RegExp(`^\\d{${n}}$`);

export const fiscalProfileSettingsSchema = z
  .object({
    enquadramento: z.enum(
      Object.keys(ENQUADRAMENTOS) as [Enquadramento, ...Enquadramento[]],
    ),
    emitter: z
      .object({
        documentKind: z.enum(["CPF", "CNPJ"]),
        document: z.string().regex(/^(\d{11}|[0-9A-Z]{12}\d{2})$/),
        municipalityIbge: z.string().regex(digits(7)),
        /** Contador confirmou a habilitação do emitente no Sistema Nacional. */
        habilitacaoConfirmadaEm: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      })
      .strict(),
    service: z
      .object({
        cTribNac: z.string().regex(FISCAL_DOMAINS.cTribNac),
        cNBS: z.string().regex(digits(9)).nullable(),
        cLocPrestacao: z.string().regex(FISCAL_DOMAINS.cLocPrestacao),
        /** Convênio do município de incidência "Ativo" no Sistema Nacional (conferido pelo contador). */
        convenioMunicipioAtivo: z.boolean(),
        convenioConferidoEm: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      })
      .strict(),
    taxes: z
      .object({
        tribISSQN: z.string().regex(FISCAL_DOMAINS.tribISSQN),
        tpRetISSQN: z.string().regex(FISCAL_DOMAINS.tpRetISSQN),
        opSimpNac: z.string().regex(FISCAL_DOMAINS.opSimpNac),
        regEspTrib: z.string().regex(FISCAL_DOMAINS.regEspTrib),
        indTotTrib: z.string().regex(FISCAL_DOMAINS.indTotTrib),
        /** TSRegimeApuracaoSimpNac: só para ME/EPP (opSimpNac 3). */
        regApTribSN: z.enum(["1", "2", "3"]).nullable(),
        /** Alíquota do ISSQN em %, definida pelo contador; a regra oficial diz se é exigida. */
        pAliq: z
          .number()
          .min(0)
          .max(5)
          .refine(
            (v) => /^\d(\.\d{1,2})?$/.test(String(v)),
            "até 2 casas decimais",
          )
          .nullable(),
      })
      .strict(),
    /** Decisão expressa sobre o grupo IBSCBS (opcional hoje; se informado, completo). */
    ibsCbs: z
      .object({
        decision: z.enum(["nao_informar", "informar"]),
        justification: z.string().trim().min(10).max(500),
      })
      .strict(),
    dpsSeries: z.number().int().min(1).max(49999),
  })
  .strict();

export type FiscalProfileSettings = z.infer<typeof fiscalProfileSettingsSchema>;

/** Rótulos em português para as mensagens de validação do cadastro. */
const FIELD_LABELS: Record<string, string> = {
  enquadramento: "Enquadramento",
  "emitter.documentKind": "Tipo de documento do emitente",
  "emitter.document": "CPF/CNPJ do emitente",
  "emitter.municipalityIbge": "Município emissor (IBGE, 7 dígitos)",
  "emitter.habilitacaoConfirmadaEm": "Data da confirmação da habilitação",
  "service.cTribNac": "Código de tributação nacional (6 dígitos)",
  "service.cNBS": "Código NBS (9 dígitos)",
  "service.cLocPrestacao": "Local da prestação (IBGE, 7 dígitos)",
  "taxes.tribISSQN": "Tributação do ISSQN",
  "taxes.tpRetISSQN": "Retenção do ISSQN",
  "taxes.opSimpNac": "Situação perante o Simples",
  "taxes.regEspTrib": "Regime especial",
  "taxes.indTotTrib": "Indicador de tributos",
  "taxes.regApTribSN": "Regime de apuração no Simples",
  "taxes.pAliq": "Alíquota do ISSQN (0 a 5%)",
  "service.convenioMunicipioAtivo":
    "Situação do convênio do município de incidência",
  "service.convenioConferidoEm": "Data da conferência do convênio",
  "ibsCbs.decision": "Decisão sobre IBS/CBS",
  "ibsCbs.justification": "Justificativa de IBS/CBS (mínimo 10 caracteres)",
  dpsSeries: "Série da DPS (1 a 49999)",
};

export function parseFiscalProfileSettings(
  raw: unknown,
):
  | { ok: true; settings: FiscalProfileSettings }
  | { ok: false; issues: string[] } {
  const r = fiscalProfileSettingsSchema.safeParse(raw);
  return r.success
    ? { ok: true, settings: r.data }
    : {
        ok: false,
        issues: [
          ...new Set(
            r.error.issues.map((i) => {
              const key = i.path.join(".");
              if (i.code === "unrecognized_keys")
                return "o cadastro tem campos que não fazem parte do perfil fiscal";
              return `${FIELD_LABELS[key] ?? (key || "perfil fiscal")}: ${
                i.code === "invalid_type"
                  ? "não preenchido"
                  : "valor inválido ou fora do domínio oficial"
              }`;
            }),
          ),
        ],
      };
}

/** Parâmetros que o conector usa na DPS, só a partir do cadastro aprovado. */
export function toFiscalParameters(s: FiscalProfileSettings): FiscalParameters {
  return {
    cTribNac: s.service.cTribNac,
    cLocPrestacao: s.service.cLocPrestacao,
    tribISSQN: s.taxes.tribISSQN,
    tpRetISSQN: s.taxes.tpRetISSQN,
    opSimpNac: s.taxes.opSimpNac,
    regEspTrib: s.taxes.regEspTrib,
    indTotTrib: s.taxes.indTotTrib,
    regApTribSN: s.taxes.regApTribSN ?? undefined,
    pAliq: s.taxes.pAliq === null ? undefined : formatAliquota(s.taxes.pAliq),
    ibsCbs: { informar: s.ibsCbs.decision === "informar" },
  };
}

export type ReadinessStatus = "ok" | "pendente" | "bloqueado" | "atencao";
export interface ReadinessItem {
  key:
    | "perfil_aprovado"
    | "cadastro_valido"
    | "habilitacao"
    | "autorizacao"
    | "certificado"
    | "servico"
    | "local_prestacao"
    | "issqn_regime"
    | "aliquota"
    | "ibs_cbs"
    | "serie";
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/**
 * Checklist de prontidão para emitir (seção 3 do pedido da WJB). Só regras
 * determinísticas. "ok" em tudo NÃO autoriza transmissão: só diz que o
 * cadastro está completo; o envio continua exigindo aprovação e autorização.
 */
export function evaluateFiscalReadiness(input: {
  profileStatus: "draft" | "approved" | "archived" | null;
  rawSettings: unknown;
  tenantDocument: string;
  authorization: EmitterAuthorization;
  layout: LayoutContract;
  seriesConfigured: number | null;
}): { ready: boolean; items: ReadinessItem[] } {
  const items: ReadinessItem[] = [];
  const push = (
    key: ReadinessItem["key"],
    label: string,
    status: ReadinessStatus,
    detail: string,
  ) => items.push({ key, label, status, detail });

  push(
    "perfil_aprovado",
    "Perfil fiscal aprovado",
    input.profileStatus === "approved" ? "ok" : "bloqueado",
    input.profileStatus === "approved"
      ? "Aprovado por contador com fiscal_profile.approve."
      : "Não há perfil aprovado vigente.",
  );

  const parsed = parseFiscalProfileSettings(input.rawSettings);
  if (!parsed.ok) {
    push(
      "cadastro_valido",
      "Parâmetros fiscais completos",
      "bloqueado",
      `Cadastro incompleto ou inválido: ${parsed.issues.slice(0, 4).join("; ")}.`,
    );
  } else {
    push(
      "cadastro_valido",
      "Parâmetros fiscais completos",
      "ok",
      "Todos os campos exigidos preenchidos com valores do domínio oficial.",
    );
  }
  const s = parsed.ok ? parsed.settings : null;
  const tenantDoc = input.tenantDocument
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");

  if (s) {
    push(
      "habilitacao",
      "Habilitação do emitente",
      s.emitter.habilitacaoConfirmadaEm ? "ok" : "pendente",
      s.emitter.habilitacaoConfirmadaEm
        ? `Confirmada pelo contador em ${s.emitter.habilitacaoConfirmadaEm} (conferência oficial só no primeiro envio em produção restrita).`
        : "O contador ainda não confirmou a habilitação no Sistema Nacional.",
    );
    if (s.emitter.document !== tenantDoc)
      items[items.length - 1] = {
        key: "habilitacao",
        label: "Habilitação do emitente",
        status: "bloqueado",
        detail:
          "O documento do emitente no perfil não é o CNPJ/CPF da empresa.",
      };
    if (
      s.emitter.documentKind === "CNPJ" &&
      /[A-Z]/.test(s.emitter.document) &&
      !input.layout.rules.alphanumericCnpj
    )
      push(
        "cadastro_valido",
        "CNPJ alfanumérico",
        "bloqueado",
        "O leiaute vigente neste ambiente ainda não aceita CNPJ alfanumérico.",
      );
  }

  if (input.authorization.ok) {
    push(
      "autorizacao",
      "Autorização de emissão",
      "ok",
      input.authorization.model === "wjb_procuracao"
        ? "Modelo A: certificado da WJB com procuração eletrônica do cliente."
        : "Modelo B: certificado do próprio cliente.",
    );
    push(
      "certificado",
      "Certificado digital",
      input.authorization.warnings.length ? "atencao" : "ok",
      input.authorization.warnings.map((w) => w.message).join(" ") ||
        `Válido até ${input.authorization.signerCertificate.validUntil}.`,
    );
  } else {
    const blockers = input.authorization.blockers;
    push(
      "autorizacao",
      "Autorização de emissão",
      "bloqueado",
      blockers.map((b) => b.message).join(" "),
    );
    push(
      "certificado",
      "Certificado digital",
      "bloqueado",
      "Sem certificado utilizável enquanto a autorização não for válida.",
    );
  }

  if (s) {
    push(
      "servico",
      "Código de serviço e tributação",
      "ok",
      `cTribNac ${s.service.cTribNac}${s.service.cNBS ? `, NBS ${s.service.cNBS}` : ""} (definido pelo contador).`,
    );
    push(
      "local_prestacao",
      "Local da prestação",
      "ok",
      `IBGE ${s.service.cLocPrestacao}.`,
    );
    const expectedOp = OP_SIMP_NAC_BY_ENQUADRAMENTO[s.enquadramento];
    if (s.taxes.opSimpNac !== expectedOp)
      push(
        "issqn_regime",
        "ISSQN, retenção e regime",
        "bloqueado",
        `Situação no Simples (${s.taxes.opSimpNac}) incoerente com o enquadramento ${ENQUADRAMENTOS[s.enquadramento]} (esperado ${expectedOp}).`,
      );
    else if (s.taxes.tribISSQN !== "1")
      push(
        "issqn_regime",
        "ISSQN, retenção e regime",
        "bloqueado",
        "Imunidade, exportação e não incidência exigem grupos adicionais da DPS que ainda não foram implementados.",
      );
    else if (s.enquadramento === "AUTONOMO" && s.emitter.documentKind !== "CPF")
      push(
        "issqn_regime",
        "ISSQN, retenção e regime",
        "bloqueado",
        "Profissional autônomo emite pelo CPF.",
      );
    else
      push(
        "issqn_regime",
        "ISSQN, retenção e regime",
        s.taxes.tpRetISSQN === "1" ? "ok" : "atencao",
        s.taxes.tpRetISSQN === "1"
          ? "Operação tributável, ISSQN não retido."
          : "ISSQN retido: cada nota passa por revisão do contador.",
      );
    const aliqIssues = checkRegimeAndAliquota(
      {
        opSimpNac: s.taxes.opSimpNac as "1" | "2" | "3",
        regApTribSN: s.taxes.regApTribSN,
        regEspTrib: s.taxes.regEspTrib,
        tribISSQN: s.taxes.tribISSQN,
        tpRetISSQN: s.taxes.tpRetISSQN,
        convenioMunicipioAtivo: s.service.convenioMunicipioAtivo,
      },
      s.taxes.pAliq,
    );
    push(
      "aliquota",
      "Regime e alíquota (regras oficiais do Anexo I)",
      aliqIssues.length
        ? "bloqueado"
        : s.service.convenioConferidoEm
          ? "ok"
          : "pendente",
      aliqIssues.length
        ? aliqIssues.map((x) => `${x.code}: ${x.message}`).join(" ")
        : s.service.convenioConferidoEm
          ? `Coerente com as regras E0595-E0640 (convênio ${s.service.convenioMunicipioAtivo ? "ativo" : "não ativo"}, conferido em ${s.service.convenioConferidoEm}).`
          : "Regras coerentes, mas a situação do convênio do município ainda não foi conferida pelo contador.",
    );
    push(
      "ibs_cbs",
      "IBS/CBS",
      s.ibsCbs.decision === "informar" ? "bloqueado" : "ok",
      s.ibsCbs.decision === "informar"
        ? "O contador decidiu informar IBS/CBS, mas o grupo completo ainda não foi implementado."
        : `Não informar por decisão do contador: ${s.ibsCbs.justification}`,
    );
    const seriesOk =
      input.seriesConfigured !== null &&
      input.seriesConfigured === s.dpsSeries &&
      isApiSeries(s.dpsSeries, input.layout);
    push(
      "serie",
      "Série e sequência da DPS",
      seriesOk ? "ok" : "bloqueado",
      seriesOk
        ? `Série ${String(s.dpsSeries).padStart(5, "0")} ativa, numeração controlada pelo banco.`
        : input.seriesConfigured === null
          ? "Série da DPS não configurada no banco."
          : `A série configurada (${input.seriesConfigured}) difere da do perfil (${s.dpsSeries}).`,
    );
  }

  return {
    ready: items.every((i) => i.status === "ok" || i.status === "atencao"),
    items,
  };
}
