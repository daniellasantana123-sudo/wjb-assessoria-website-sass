import { isFiscalProductionAllowed } from "@/lib/wjb-ai/config";
import { createCertificateVault } from "@/lib/wjb-ai/fiscal/certificate-vault";
import {
  createIcpBrasilTrustStore,
  createRevocationChecker,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import { unconfirmedContractFields } from "@/lib/wjb-ai/fiscal/national/official-transport";
import { SIGNATURE_ALGORITHM_PENDING } from "@/lib/wjb-ai/fiscal/national/signing";

/**
 * Portão ÚNICO da transmissão oficial (Fase 10B). Falha fechada: qualquer
 * condição não comprovada bloqueia, e o bloqueio é auditado com os códigos
 * (sem dado pessoal, sem segredo).
 *
 * Condições, TODAS obrigatórias:
 * - ambiente: produção restrita (produção não está autorizada);
 * - interruptor de runtime WJB_AI_OFFICIAL_TRANSMISSION_ENABLED=true;
 * - contrato da API conferido no swagger autenticado (nenhum campo inferido);
 * - algoritmo de assinatura confirmado em documento oficial VIGENTE;
 * - cofre de certificados contratado e configurado;
 * - cadeia ICP-Brasil e verificação de revogação configuradas.
 *
 * Nesta fase nenhuma está satisfeita (doc FASE-10B-CHECKLIST-ATIVACAO), então
 * o portão sempre bloqueia. Ligar o interruptor sozinho não libera nada.
 */
export type GateEnvironment = "producao_restrita" | "producao";

export interface GateState {
  environment: GateEnvironment;
  switchOn: boolean;
  productionAllowed: boolean;
  unconfirmedContractFields: string[];
  signatureAlgorithmConfirmed: boolean;
  vaultConfigured: boolean;
  trustStoreConfigured: boolean;
  revocationConfigured: boolean;
}

export interface GateBlocker {
  code: string;
  message: string;
}

export type GateDecision =
  { open: true } | { open: false; blockers: GateBlocker[] };

export function evaluateTransmissionGate(state: GateState): GateDecision {
  const b: GateBlocker[] = [];
  if (state.environment === "producao" && !state.productionAllowed)
    b.push({
      code: "GATE_PRODUCTION_NOT_ALLOWED",
      message: "Emissão em produção não autorizada.",
    });
  if (!state.switchOn)
    b.push({
      code: "GATE_SWITCH_OFF",
      message: "Interruptor de transmissão oficial desligado.",
    });
  if (state.unconfirmedContractFields.length)
    b.push({
      code: "GATE_CONTRACT_UNCONFIRMED",
      message: `Contrato da API não conferido no swagger: ${state.unconfirmedContractFields.join(", ")}.`,
    });
  if (!state.signatureAlgorithmConfirmed)
    b.push({
      code: "GATE_SIGNATURE_ALGORITHM_UNCONFIRMED",
      message:
        "Algoritmo de assinatura não confirmado em documento oficial vigente.",
    });
  if (!state.vaultConfigured)
    b.push({
      code: "GATE_VAULT_NOT_CONFIGURED",
      message: "Cofre de certificados não configurado.",
    });
  if (!state.trustStoreConfigured)
    b.push({
      code: "GATE_TRUST_STORE_NOT_CONFIGURED",
      message: "Cadeia ICP-Brasil não configurada.",
    });
  if (!state.revocationConfigured)
    b.push({
      code: "GATE_REVOCATION_NOT_CONFIGURED",
      message: "Verificação de revogação não configurada.",
    });
  return b.length ? { open: false, blockers: b } : { open: true };
}

function configured(factory: () => unknown): boolean {
  try {
    factory();
    return true;
  } catch {
    return false;
  }
}

/** Estado REAL do ambiente, lido em runtime (nunca do build). */
export function currentGateState(environment: GateEnvironment): GateState {
  return {
    environment,
    switchOn:
      process.env["WJB_AI_OFFICIAL_TRANSMISSION_ENABLED"]
        ?.trim()
        .toLowerCase() === "true",
    productionAllowed: isFiscalProductionAllowed(),
    unconfirmedContractFields: unconfirmedContractFields(),
    signatureAlgorithmConfirmed: SIGNATURE_ALGORITHM_PENDING.confirmed,
    vaultConfigured: configured(createCertificateVault),
    trustStoreConfigured: configured(createIcpBrasilTrustStore),
    revocationConfigured: configured(createRevocationChecker),
  };
}

export interface GateAuditSink {
  blocked(entry: {
    environment: GateEnvironment;
    codes: string[];
    origin: string;
  }): Promise<void>;
}

export class TransmissionBlockedError extends Error {
  constructor(readonly blockers: GateBlocker[]) {
    super(
      `Transmissão oficial bloqueada: ${blockers.map((b) => b.code).join(", ")}.`,
    );
    this.name = "TransmissionBlockedError";
  }
}

/**
 * Exige o portão aberto. Bloqueado: audita e lança. Erro do registro de
 * auditoria nunca libera a transmissão (continua lançando o bloqueio).
 */
export async function requireOpenGate(
  state: GateState,
  audit: GateAuditSink,
  origin: string,
): Promise<void> {
  const decision = evaluateTransmissionGate(state);
  if (decision.open) return;
  try {
    await audit.blocked({
      environment: state.environment,
      codes: decision.blockers.map((b) => b.code),
      origin,
    });
  } catch {
    // auditoria indisponível: o bloqueio vale do mesmo jeito
  }
  throw new TransmissionBlockedError(decision.blockers);
}
