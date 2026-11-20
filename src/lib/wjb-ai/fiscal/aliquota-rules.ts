/**
 * Regras oficiais de regime e alíquota do ISSQN na DPS (Fase 6).
 * Fonte: Anexo I v1.01 (09/02/2026), aba "RN DPS_NFS-e", regras 226, 230 e
 * 501-513 (códigos E0162, E0175, E0595, E0600, E0602, E0604, E0617, E0619,
 * E0621, E0625, E0628, E0631, E0635, E0640).
 *
 * Determinístico: a combinação de situação no Simples, forma de apuração,
 * regime especial, tributação, retenção e situação do convênio do município
 * de incidência diz se a alíquota é PROIBIDA ou OBRIGATÓRIA. O VALOR da
 * alíquota é sempre do contador; o sistema só confere a regra.
 *
 * Fora do escopo (o cadastro ainda não suporta, então não é informado):
 * benefício municipal (regra 505 / E0612).
 */
export interface RegimeInput {
  opSimpNac: "1" | "2" | "3";
  regApTribSN: "1" | "2" | "3" | null;
  regEspTrib: string;
  tribISSQN: string;
  tpRetISSQN: string;
  /** Convênio do município de incidência "Ativo" no Sistema Nacional na competência. */
  convenioMunicipioAtivo: boolean;
}

export interface RuleIssue {
  code: string;
  message: string;
}

export type AliquotaRule =
  | { mode: "proibida"; code: string; reason: string }
  | {
      mode: "obrigatoria";
      code: string;
      reason: string;
      min: number;
      max: number;
    };

const MAX = 5; // regra 501 / E0595
const MIN_SN_RETIDO = 1.8; // regras 508 e 510

export function aliquotaRule(i: RegimeInput): AliquotaRule {
  if (["2", "3", "4"].includes(i.tribISSQN))
    return {
      mode: "proibida",
      code: "E0602",
      reason: "Imunidade, exportação ou não incidência.",
    };
  if (i.opSimpNac === "2")
    return { mode: "proibida", code: "E0600", reason: "Prestador MEI." };
  if (i.regEspTrib !== "0")
    return {
      mode: "proibida",
      code: "E0604",
      reason: "Prestador com regime especial de tributação.",
    };
  if (i.opSimpNac === "1")
    return i.convenioMunicipioAtivo
      ? {
          mode: "proibida",
          code: "E0617",
          reason: "Não optante com município de incidência ativo.",
        }
      : {
          mode: "obrigatoria",
          code: "E0619",
          reason: "Não optante com município de incidência não ativo.",
          min: 0,
          max: MAX,
        };
  // opSimpNac = 3 (ME/EPP)
  const retido = i.tpRetISSQN === "2" || i.tpRetISSQN === "3";
  if (i.regApTribSN === "1") {
    if (i.convenioMunicipioAtivo)
      return retido
        ? {
            mode: "obrigatoria",
            code: "E0621",
            reason: "ME/EPP pelo SN, município ativo, ISSQN retido.",
            min: MIN_SN_RETIDO,
            max: MAX,
          }
        : {
            mode: "proibida",
            code: "E0625",
            reason: "ME/EPP pelo SN, município ativo, sem retenção.",
          };
    return retido
      ? {
          mode: "obrigatoria",
          code: "E0628",
          reason: "ME/EPP pelo SN, município não ativo, ISSQN retido.",
          min: MIN_SN_RETIDO,
          max: MAX,
        }
      : {
          mode: "proibida",
          code: "E0631",
          reason: "ME/EPP pelo SN, município não ativo, sem retenção.",
        };
  }
  // regApTribSN 2 ou 3: ISSQN fora do Simples
  return i.convenioMunicipioAtivo
    ? {
        mode: "proibida",
        code: "E0635",
        reason: "ME/EPP com ISSQN fora do SN e município ativo.",
      }
    : {
        mode: "obrigatoria",
        code: "E0640",
        reason: "ME/EPP com ISSQN fora do SN e município não ativo.",
        min: 0,
        max: MAX,
      };
}

/** Coerência do regime (regras 226 e 230) e da alíquota informada. */
export function checkRegimeAndAliquota(
  i: RegimeInput,
  pAliq: number | null,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (i.opSimpNac !== "3" && i.regApTribSN !== null)
    issues.push({
      code: "E0162",
      message: "Regime de apuração do SN só existe para ME/EPP (opSimpNac 3).",
    });
  if (i.opSimpNac === "3" && i.regApTribSN === null)
    issues.push({
      code: "CADASTRO",
      message:
        "ME/EPP: informe o regime de apuração (regApTribSN); a regra da alíquota depende dele.",
    });
  if (i.opSimpNac === "3" && i.regApTribSN === "1" && i.regEspTrib !== "0")
    issues.push({
      code: "E0175",
      message: "ME/EPP apurando pelo SN deve ter regime especial 0 (Nenhum).",
    });
  if (issues.length) return issues;

  const rule = aliquotaRule(i);
  if (rule.mode === "proibida" && pAliq !== null)
    issues.push({
      code: rule.code,
      message: `Alíquota não pode ser informada: ${rule.reason}`,
    });
  if (rule.mode === "obrigatoria") {
    if (pAliq === null)
      issues.push({
        code: rule.code,
        message: `Alíquota obrigatória: ${rule.reason}`,
      });
    else if (pAliq > rule.max)
      issues.push({ code: "E0595", message: "Alíquota acima de 5%." });
    else if (pAliq < rule.min)
      issues.push({
        code: rule.code,
        message: `Alíquota mínima de ${rule.min.toFixed(2)}% neste cenário.`,
      });
  }
  return issues;
}

/** Formato TSDec1V2: "0" ou um dígito com 2 casas ("2.50"). */
export function formatAliquota(p: number): string {
  return p === 0 ? "0" : p.toFixed(2);
}
