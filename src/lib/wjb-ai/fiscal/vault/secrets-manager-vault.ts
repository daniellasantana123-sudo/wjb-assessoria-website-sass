import "server-only";

import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";

import type { CertificateVault } from "@/lib/wjb-ai/fiscal/certificate-vault";
import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";
import { VaultError, type SecretStore } from "@/lib/wjb-ai/fiscal/vault/secret-stores";

/**
 * Cofre de certificados sobre um gerenciador de segredos (Fase 10D).
 *
 * Formato guardado no cofre (doc 03 da Fase 10D), DOIS segredos:
 * - `<nome>`: JSON `{"format":"wjb-cert-v1","certificatePem":"-----BEGIN
 *   CERTIFICATE-----...","privateKeyPem":"-----BEGIN ENCRYPTED PRIVATE
 *   KEY-----..."}`. A chave fica cifrada (PKCS#8) mesmo dentro do cofre;
 * - `<nome>-senha`: a senha dessa chave.
 * O PFX/A1 é convertido UMA vez, pela titular, no computador dela (openssl),
 * porque o Node não abre PKCS#12 sem biblioteca. O PFX nunca vai para o
 * repositório, o Supabase, o chat ou logs.
 *
 * Recusa chave sem cifra, chave que não corresponde ao certificado e
 * referência que não seja `vault://aws/...` ou `vault://azure/...` do
 * provedor configurado. A política do certificado (cadeia, revogação,
 * incidente) continua sendo aplicada por `useCertificate` a cada uso.
 */
export type VaultReferenceProvider = "aws" | "azure";

export function parseVaultReference(ref: string): { provider: VaultReferenceProvider; name: string } {
  const m = /^vault:\/\/(aws|azure)\/([A-Za-z0-9-]{3,120})$/.exec(ref);
  if (!m) throw new VaultError("VAULT_CONFIG");
  return { provider: m[1] as VaultReferenceProvider, name: m[2] };
}

export function materialFromSecrets(json: Buffer, passphrase: Buffer): SigningMaterial {
  let v: { format?: unknown; certificatePem?: unknown; privateKeyPem?: unknown };
  try {
    v = JSON.parse(json.toString("utf8")) as typeof v;
  } catch {
    throw new VaultError("VAULT_BAD_RESPONSE");
  }
  if (v.format !== "wjb-cert-v1" || typeof v.certificatePem !== "string" || typeof v.privateKeyPem !== "string")
    throw new VaultError("VAULT_BAD_RESPONSE");
  // Chave sem cifra no cofre não é aceita (defesa em profundidade).
  if (!/^-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(v.privateKeyPem.trim())) throw new VaultError("VAULT_BAD_RESPONSE");
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(v.certificatePem);
  } catch {
    throw new VaultError("VAULT_BAD_RESPONSE");
  }
  let privateKey;
  try {
    privateKey = createPrivateKey({ key: v.privateKeyPem, format: "pem", passphrase: passphrase.toString("utf8") });
  } catch {
    // Senha errada ou chave corrompida: mesmo código, sem detalhe.
    throw new VaultError("VAULT_BAD_RESPONSE");
  }
  const fromKey = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const fromCert = cert.publicKey.export({ type: "spki", format: "der" });
  if (!fromKey.equals(fromCert)) throw new VaultError("VAULT_BAD_RESPONSE");
  return { privateKey, certificateDer: cert.raw };
}

export class SecretsManagerCertificateVault implements CertificateVault {
  readonly kind = "gerenciador-de-segredos" as const;
  constructor(
    private readonly store: SecretStore,
    private readonly provider: VaultReferenceProvider,
  ) {
    const expected = store.provider === "aws-secrets-manager" ? "aws" : "azure";
    if (expected !== provider) throw new VaultError("VAULT_CONFIG");
  }
  async load(reference: string): Promise<SigningMaterial> {
    const ref = parseVaultReference(reference);
    if (ref.provider !== this.provider) throw new VaultError("VAULT_CONFIG");
    const [json, pass] = await Promise.all([this.store.getSecret(ref.name), this.store.getSecret(`${ref.name}-senha`)]);
    return materialFromSecrets(json, pass);
  }
}
