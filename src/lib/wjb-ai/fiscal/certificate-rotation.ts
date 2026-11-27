import "server-only";

import type { CertificateVault } from "@/lib/wjb-ai/fiscal/certificate-vault";
import {
  evaluateRotation,
  type CertificateRole,
  type RegisteredCertificate,
  type RotationIssue,
} from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import { X509Certificate } from "node:crypto";

import { spkiSha256 } from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import { inspectCertificate } from "@/lib/wjb-ai/fiscal/national/certificate-inspect";
import {
  CERTIFICATE_POLICY,
  evaluateCertificatePolicy,
  type RevocationChecker,
  type TrustStore,
} from "@/lib/wjb-ai/fiscal/national/certificate-policy";

/**
 * Cadastro e rotação do certificado (Fase 10C). O material só vem do cofre;
 * o registro guarda metadados públicos. Cada passo reaplica a política
 * completa ao certificado real (a revogação pode mudar entre o cadastro e a
 * rotação). Nenhum cofre real está contratado nesta fase: na aplicação, a
 * fábrica do cofre recusa e estas funções não chegam a ser usadas.
 */
export interface CertificateRegistryRepo {
  insertPending(
    row: Omit<RegisteredCertificate, "id" | "status"> & {
      kind: "A1" | "A3";
      vaultReference: string;
      policyCheckedAt: string;
      createdBy: string | null;
    },
  ): Promise<string>;
  get(id: string): Promise<(RegisteredCertificate & { vaultReference: string }) | null>;
  getActive(role: CertificateRole, tenantId: string | null): Promise<RegisteredCertificate | null>;
  /** Impressão digital OU chave pública na lista permanente. */
  isBlocked(fingerprint: string, spki: string): Promise<boolean>;
  /** Troca atômica: devolve o id do certificado substituído (ou null). */
  rotate(id: string): Promise<string | null>;
}

export interface LifecycleDeps {
  vault: CertificateVault;
  trust: TrustStore | null;
  revocation: RevocationChecker | null;
  repo: CertificateRegistryRepo;
  now?: Date;
  /** Fora de testes: true (exige ICP-Brasil e LCR/OCSP reais). */
  requireRealVerification: boolean;
}

export type LifecycleResult<T> = { ok: true; value: T; warnings: RotationIssue[] } | { ok: false; blockers: RotationIssue[] };

const fail = (code: string, message: string) => ({ ok: false as const, blockers: [{ code, message }] });

async function verify(vaultReference: string, role: CertificateRole, deps: LifecycleDeps) {
  const material = await deps.vault.load(vaultReference);
  const meta = inspectCertificate(material.certificateDer, vaultReference);
  const spki = spkiSha256(
    new X509Certificate(material.certificateDer).publicKey.export({ type: "spki", format: "der" }),
  );
  const policy = await evaluateCertificatePolicy({
    certificate: material.certificateDer,
    role,
    at: deps.now,
    trust: deps.trust,
    revocation: deps.revocation,
  });
  return { meta, policy, spki };
}

/** Cadastra um certificado novo como PENDENTE, depois de passar pela política. */
export async function registerCertificateFromVault(
  input: {
    vaultReference: string;
    role: CertificateRole;
    tenantId: string | null;
    /** Documento da empresa (cliente): o e-CNPJ precisa ser dela. */
    tenantDocument?: string | null;
    actorId: string | null;
  },
  deps: LifecycleDeps,
): Promise<LifecycleResult<{ id: string }>> {
  const now = deps.now ?? new Date();
  let verified;
  try {
    verified = await verify(input.vaultReference, input.role, deps);
  } catch {
    return fail("VAULT_UNAVAILABLE", "Não foi possível ler o certificado no cofre.");
  }
  const { meta, policy, spki } = verified;
  if (await deps.repo.isBlocked(meta.fingerprintSha256, spki))
    return fail("CERT_BLOCKLISTED", "Certificado bloqueado permanentemente.");
  const candidate: RegisteredCertificate = {
    id: "novo",
    role: input.role,
    tenantId: input.tenantId,
    fingerprint: meta.fingerprintSha256,
    spki,
    holderDocument: meta.holderDocument,
    validFrom: `${meta.validFrom}T00:00:00Z`,
    validUntil: `${meta.validUntil}T00:00:00Z`,
    status: "pendente",
  };
  const check = evaluateRotation({
    current: await deps.repo.getActive(input.role, input.tenantId),
    candidate,
    policy,
    trustKind: deps.trust?.kind ?? null,
    revocationKind: deps.revocation?.kind ?? null,
    requireRealVerification: deps.requireRealVerification,
    wjbDocuments: CERTIFICATE_POLICY.wjbDocuments,
    tenantDocument: input.tenantDocument,
    now,
  });
  if (!check.ok) return check;
  const id = await deps.repo.insertPending({
    role: candidate.role,
    tenantId: candidate.tenantId,
    fingerprint: candidate.fingerprint,
    spki,
    holderDocument: candidate.holderDocument,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
    kind: meta.kind,
    vaultReference: input.vaultReference,
    policyCheckedAt: now.toISOString(),
    createdBy: input.actorId,
  });
  return { ok: true, value: { id }, warnings: check.warnings };
}

/** Ativa um certificado pendente; o ativo anterior fica bloqueado para sempre. */
export async function rotateToCertificate(
  candidateId: string,
  deps: LifecycleDeps,
  tenantDocument?: string | null,
): Promise<LifecycleResult<{ replaced: string | null }>> {
  const now = deps.now ?? new Date();
  const candidate = await deps.repo.get(candidateId);
  if (!candidate) return fail("CANDIDATE_NOT_FOUND", "Certificado novo não encontrado.");
  let verified;
  try {
    verified = await verify(candidate.vaultReference, candidate.role, deps);
  } catch {
    return fail("VAULT_UNAVAILABLE", "Não foi possível ler o certificado no cofre.");
  }
  if (verified.meta.fingerprintSha256 !== candidate.fingerprint)
    return fail("VAULT_MATERIAL_CHANGED", "O certificado no cofre não é o cadastrado.");
  if (await deps.repo.isBlocked(candidate.fingerprint, verified.spki))
    return fail("CERT_BLOCKLISTED", "Certificado bloqueado permanentemente.");
  const check = evaluateRotation({
    current: await deps.repo.getActive(candidate.role, candidate.tenantId),
    candidate: { ...candidate, spki: verified.spki },
    policy: verified.policy,
    trustKind: deps.trust?.kind ?? null,
    revocationKind: deps.revocation?.kind ?? null,
    requireRealVerification: deps.requireRealVerification,
    wjbDocuments: CERTIFICATE_POLICY.wjbDocuments,
    tenantDocument,
    now,
  });
  if (!check.ok) return check;
  const replaced = await deps.repo.rotate(candidateId);
  return { ok: true, value: { replaced }, warnings: check.warnings };
}

/** Só para testes: repositório em memória com as regras da migration 0036. */
export class InMemoryCertificateRegistry implements CertificateRegistryRepo {
  readonly rows = new Map<string, RegisteredCertificate & { vaultReference: string }>();
  readonly blocklist = new Set<string>();
  readonly keyBlocklist = new Set<string>();
  private seq = 0;
  async insertPending(row: Parameters<CertificateRegistryRepo["insertPending"]>[0]) {
    if (this.blocklist.has(row.fingerprint) || (row.spki && this.keyBlocklist.has(row.spki))) throw new Error("bloqueado");
    if ([...this.rows.values()].some((r) => r.fingerprint === row.fingerprint)) throw new Error("duplicado");
    const id = `cert-${++this.seq}`;
    this.rows.set(id, {
      id,
      role: row.role,
      tenantId: row.tenantId,
      fingerprint: row.fingerprint,
      spki: row.spki,
      holderDocument: row.holderDocument,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      status: "pendente",
      vaultReference: row.vaultReference,
    });
    return id;
  }
  async get(id: string) {
    return this.rows.get(id) ?? null;
  }
  async getActive(role: CertificateRole, tenantId: string | null) {
    return [...this.rows.values()].find((r) => r.role === role && r.tenantId === tenantId && r.status === "ativo") ?? null;
  }
  async isBlocked(fingerprint: string, spki: string) {
    return this.blocklist.has(fingerprint) || this.keyBlocklist.has(spki);
  }
  async rotate(id: string) {
    const n = this.rows.get(id);
    if (!n || n.status !== "pendente") throw new Error("pendente");
    const old = await this.getActive(n.role, n.tenantId);
    if (old) {
      if (old.holderDocument !== n.holderDocument) throw new Error("titular");
      if (old.spki && old.spki === n.spki) throw new Error("mesma chave");
      old.status = "substituido";
      this.blocklist.add(old.fingerprint);
      if (old.spki) this.keyBlocklist.add(old.spki);
    }
    n.status = "ativo";
    return old?.id ?? null;
  }
  /** Estado para `useCertificate`. */
  lookup() {
    return {
      state: async (fingerprint: string, spki: string) => {
        const c = [...this.rows.values()].find((r) => r.fingerprint === fingerprint);
        return {
          registered: !!c,
          status: c?.status ?? null,
          blocked: this.blocklist.has(fingerprint) || this.keyBlocklist.has(spki),
          role: c?.role ?? null,
          tenantId: c?.tenantId ?? null,
        };
      },
    };
  }
}
