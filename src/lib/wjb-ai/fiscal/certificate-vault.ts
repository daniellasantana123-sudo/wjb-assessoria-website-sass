import type { EmitterAuthorization } from "@/lib/wjb-ai/fiscal/emitter-authorization";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import {
  evaluateCertificatePolicy,
  type CertificatePolicyConfig,
  type RevocationChecker,
  type TrustStore,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";
import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";

/**
 * Custódia e uso do certificado digital (Fase 6).
 *
 * Regras (doc 29):
 * - o certificado só é carregado do COFRE, pela referência `vault://...`;
 *   nunca do banco, do repositório, de variável de ambiente ou do navegador;
 * - cada uso passa por `useCertificate`: reconfere a autorização NA HORA,
 *   confere a impressão digital do que veio do cofre contra a registrada
 *   (certificado trocado no cofre = uso negado) e grava a trilha de uso;
 * - a trilha nunca contém chave, senha ou o certificado, só a impressão
 *   digital pública e o resultado.
 *
 * Nenhum cofre real está contratado: `createCertificateVault()` recusa. Para
 * testes existe só `TestCertificateVault`, que aceita apenas referências
 * `vault://teste/...` e material gerado na hora.
 */
export interface CertificateVault {
  readonly kind: "teste" | "gerenciador-de-segredos";
  load(reference: string): Promise<SigningMaterial>;
}

export class CertificateVaultNotConfiguredError extends Error {
  constructor() {
    super(
      "Cofre de certificados não configurado: nenhum serviço contratado e nenhum certificado autorizado nesta fase.",
    );
    this.name = "CertificateVaultNotConfiguredError";
  }
}

export function createCertificateVault(): CertificateVault {
  throw new CertificateVaultNotConfiguredError();
}

/** Só para testes: aceita apenas `vault://teste/...`. */
export class TestCertificateVault implements CertificateVault {
  readonly kind = "teste" as const;
  private readonly items = new Map<string, SigningMaterial>();
  put(reference: string, material: SigningMaterial) {
    if (!reference.startsWith("vault://teste/"))
      throw new Error("O cofre de teste só aceita referências vault://teste/.");
    this.items.set(reference, material);
  }
  async load(reference: string): Promise<SigningMaterial> {
    const m = this.items.get(reference);
    if (!m) throw new Error("Certificado não encontrado no cofre.");
    return m;
  }
}

export type CertificatePurpose = "assinatura" | "mtls";
export type CertificateUsageOutcome = "ok" | "negado" | "erro";

export interface CertificateUsageRecord {
  tenantId: string;
  requestId: string | null;
  grantId: string | null;
  emissionModel: string | null;
  certificateFingerprint: string | null;
  purpose: CertificatePurpose;
  environment: "simulado" | "producao_restrita" | "producao";
  outcome: CertificateUsageOutcome;
  reason: string | null;
}

export interface CertificateUsageSink {
  record(entry: CertificateUsageRecord): Promise<void>;
}

export class InMemoryCertificateUsageSink implements CertificateUsageSink {
  entries: CertificateUsageRecord[] = [];
  async record(entry: CertificateUsageRecord) {
    this.entries.push(entry);
  }
}

export class CertificateUseDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateUseDeniedError";
  }
}

export async function useCertificate<T>(
  request: {
    tenantId: string;
    requestId: string | null;
    purpose: CertificatePurpose;
    environment: CertificateUsageRecord["environment"];
  },
  deps: {
    /** Reavalia a autorização no momento do uso (procuração pode ter sido revogada). */
    authorize: () => Promise<EmitterAuthorization>;
    vault: CertificateVault;
    audit: CertificateUsageSink;
    /**
     * Fase 10B: política do certificado REAL (cadeia, revogação, algoritmo,
     * incidente de 26/11/2026). Obrigatórios: `null` = não configurado =
     * uso negado (falha fechada).
     */
    trust: TrustStore | null;
    revocation: RevocationChecker | null;
    today?: string;
    policyConfig?: CertificatePolicyConfig;
  },
  fn: (material: SigningMaterial) => Promise<T>,
): Promise<T> {
  const base = {
    ...request,
    grantId: null,
    emissionModel: null,
    certificateFingerprint: null,
  };
  if (request.environment === "producao") {
    await deps.audit.record({
      ...base,
      outcome: "negado",
      reason: "Produção não autorizada nesta fase.",
    });
    throw new CertificateUseDeniedError(
      "Uso do certificado em produção não está autorizado.",
    );
  }
  const auth = await deps.authorize();
  if (!auth.ok) {
    const reason = auth.blockers.map((b) => b.code).join(",");
    await deps.audit.record({ ...base, outcome: "negado", reason });
    throw new CertificateUseDeniedError(
      `Autorização de emissão inválida: ${reason}.`,
    );
  }
  const ctx = {
    ...base,
    grantId: auth.grantId,
    emissionModel: auth.model,
    certificateFingerprint: auth.signerCertificate.fingerprintSha256,
  };
  let material: SigningMaterial;
  try {
    material = await deps.vault.load(auth.signerCertificate.vaultReference);
  } catch {
    await deps.audit.record({
      ...ctx,
      outcome: "erro",
      reason: "Falha ao ler o cofre.",
    });
    throw new CertificateUseDeniedError(
      "Não foi possível ler o certificado no cofre.",
    );
  }
  const actual = inspectCertificate(
    material.certificateDer,
    auth.signerCertificate.vaultReference,
  );
  if (actual.fingerprintSha256 !== auth.signerCertificate.fingerprintSha256) {
    await deps.audit.record({
      ...ctx,
      outcome: "negado",
      reason: "CERT_FINGERPRINT_MISMATCH",
    });
    throw new CertificateUseDeniedError(
      "O certificado no cofre não é o registrado na autorização.",
    );
  }
  if (actual.holderDocument !== auth.signerCertificate.holderDocument) {
    await deps.audit.record({
      ...ctx,
      outcome: "negado",
      reason: "CERT_HOLDER_MISMATCH",
    });
    throw new CertificateUseDeniedError(
      "Titular do certificado no cofre diverge do registrado.",
    );
  }
  const policy = await evaluateCertificatePolicy({
    certificate: material.certificateDer,
    role: auth.model === "wjb_procuracao" ? "wjb" : "cliente",
    today: deps.today ?? new Date().toISOString().slice(0, 10),
    trust: deps.trust,
    revocation: deps.revocation,
    config: deps.policyConfig,
  });
  if (!policy.ok) {
    const reason = policy.blockers.map((b) => b.code).join(",");
    await deps.audit.record({ ...ctx, outcome: "negado", reason });
    throw new CertificateUseDeniedError(
      `Certificado recusado pela política: ${reason}.`,
    );
  }
  try {
    const result = await fn(material);
    await deps.audit.record({ ...ctx, outcome: "ok", reason: null });
    return result;
  } catch (e) {
    await deps.audit.record({
      ...ctx,
      outcome: "erro",
      reason: (e as Error).name,
    });
    throw e;
  }
}
