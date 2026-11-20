import {
  parseFiscalProfileSettings,
  type FiscalProfileSettings,
} from "@/lib/wjb-ai/fiscal/profile-settings";
import {
  looksLikeSecret,
  SHA256_HEX,
  VAULT_REFERENCE,
} from "@/lib/wjb-ai/fiscal/secret-guard";

/**
 * Conversão dos formulários do Admin (Fase 5) em dados validados. Funções
 * puras para teste. Nada aqui inventa valor: campo vazio continua vazio e o
 * schema estrito recusa.
 */
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const docOf = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function parseFiscalSettingsForm(
  fd: FormData,
):
  { ok: true; settings: FiscalProfileSettings } | { ok: false; error: string } {
  for (const [, v] of fd.entries())
    if (typeof v === "string" && looksLikeSecret(v))
      return {
        ok: false,
        error:
          "Um campo parece conter chave ou senha. Nunca cole segredos aqui.",
      };
  const series = Number(str(fd, "dpsSeries"));
  const candidate = {
    enquadramento: str(fd, "enquadramento"),
    emitter: {
      documentKind: str(fd, "documentKind"),
      document: docOf(str(fd, "emitterDocument")),
      municipalityIbge: str(fd, "municipalityIbge"),
      habilitacaoConfirmadaEm: str(fd, "habilitacaoConfirmadaEm") || null,
    },
    service: {
      cTribNac: str(fd, "cTribNac"),
      cNBS: str(fd, "cNBS") || null,
      cLocPrestacao: str(fd, "cLocPrestacao"),
    },
    taxes: {
      tribISSQN: str(fd, "tribISSQN"),
      tpRetISSQN: str(fd, "tpRetISSQN"),
      opSimpNac: str(fd, "opSimpNac"),
      regEspTrib: str(fd, "regEspTrib"),
      indTotTrib: "0", // domínio oficial de valor único (TSTipoIndTotTrib)
    },
    ibsCbs: {
      decision: str(fd, "ibsCbsDecision"),
      justification: str(fd, "ibsCbsJustification"),
    },
    dpsSeries: Number.isFinite(series) ? series : NaN,
  };
  const parsed = parseFiscalProfileSettings(candidate);
  return parsed.ok
    ? parsed
    : {
        ok: false,
        error: `Revise os campos: ${parsed.issues.slice(0, 3).join("; ")}.`,
      };
}

export interface AuthorizationInput {
  kind: "procuracao" | "certificado_proprio" | "consentimento_assistido";
  emission_model: "wjb_procuracao" | "certificado_cliente" | null;
  scope: string;
  valid_until: string;
  evidence_reference: string;
  certificate_holder_document: string | null;
  certificate_valid_from: string | null;
  certificate_valid_until: string | null;
  certificate_fingerprint_sha256: string | null;
  certificate_vault_reference: string | null;
  certificate_kind: "A1" | "A3" | null;
  certificate_requirements_confirmed: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuthorizationForm(
  fd: FormData,
): { ok: true; value: AuthorizationInput } | { ok: false; error: string } {
  for (const [, v] of fd.entries())
    if (typeof v === "string" && looksLikeSecret(v))
      return {
        ok: false,
        error:
          "Um campo parece conter chave, certificado ou senha. Registre só a referência ao cofre.",
      };
  const model = str(fd, "emissionModel");
  const kind =
    model === "wjb_procuracao"
      ? "procuracao"
      : model === "certificado_cliente"
        ? "certificado_proprio"
        : str(fd, "kind");
  if (
    !["procuracao", "certificado_proprio", "consentimento_assistido"].includes(
      kind,
    )
  )
    return { ok: false, error: "Tipo inválido." };
  const scope = str(fd, "scope");
  const validUntil = str(fd, "validUntil");
  const evidence = str(fd, "evidence");
  if (scope.length < 5)
    return { ok: false, error: "Descreva o escopo da autorização." };
  if (!DATE.test(validUntil))
    return { ok: false, error: "Informe a validade." };
  if (!evidence || evidence.length > 300)
    return {
      ok: false,
      error:
        "Informe onde está guardada a evidência (nunca o arquivo ou a senha).",
    };

  const holder = docOf(str(fd, "holderDocument")) || null;
  const certFrom = str(fd, "certValidFrom") || null;
  const certUntil = str(fd, "certValidUntil") || null;
  const fingerprint =
    str(fd, "certFingerprint").toLowerCase().replace(/:/g, "") || null;
  const vault = str(fd, "vaultReference") || null;
  const certKind = str(fd, "certKind") || null;

  if (model === "wjb_procuracao" && (!holder || !/^\d{14}$/.test(holder)))
    return {
      ok: false,
      error: "Modelo A: informe o CNPJ da WJB que recebeu a procuração.",
    };
  if (model === "certificado_cliente") {
    if (!holder || !/^(\d{11}|[0-9A-Z]{12}\d{2})$/.test(holder))
      return {
        ok: false,
        error: "Modelo B: informe o CPF/CNPJ do titular do certificado.",
      };
    if (
      !certFrom ||
      !certUntil ||
      !DATE.test(certFrom) ||
      !DATE.test(certUntil) ||
      certUntil <= certFrom
    )
      return {
        ok: false,
        error: "Modelo B: informe a validade do certificado (início e fim).",
      };
    if (!fingerprint || !SHA256_HEX.test(fingerprint))
      return {
        ok: false,
        error:
          "Modelo B: impressão digital SHA-256 do certificado (64 caracteres hexadecimais).",
      };
    if (!vault || !VAULT_REFERENCE.test(vault))
      return {
        ok: false,
        error: "Modelo B: referência ao cofre no formato vault://...",
      };
    if (certKind !== "A1" && certKind !== "A3")
      return {
        ok: false,
        error: "Modelo B: informe se o certificado é A1 ou A3.",
      };
  }
  return {
    ok: true,
    value: {
      kind: kind as AuthorizationInput["kind"],
      emission_model:
        model === "wjb_procuracao" || model === "certificado_cliente"
          ? model
          : null,
      scope,
      valid_until: validUntil,
      evidence_reference: evidence,
      certificate_holder_document: holder,
      certificate_valid_from: model === "certificado_cliente" ? certFrom : null,
      certificate_valid_until:
        model === "certificado_cliente" ? certUntil : null,
      certificate_fingerprint_sha256:
        model === "certificado_cliente" ? fingerprint : null,
      certificate_vault_reference:
        model === "certificado_cliente" ? vault : null,
      certificate_kind:
        model === "certificado_cliente" ? (certKind as "A1" | "A3") : null,
      certificate_requirements_confirmed:
        model === "certificado_cliente" && fd.get("certRequirements") === "on",
    },
  };
}
