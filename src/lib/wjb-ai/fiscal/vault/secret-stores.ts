import "server-only";

import { signAwsRequest, type AwsCredentials } from "@/lib/wjb-ai/fiscal/vault/aws-sigv4";

/**
 * Adaptadores de cofre de segredos (Fase 10D): AWS Secrets Manager e Azure
 * Key Vault, pela API REST oficial, sem SDK e sem dependência nova. NADA foi
 * contratado: os adaptadores existem e são testados com um cliente HTTP
 * falso; a fábrica do cofre (`createCertificateVault`) continua recusando até
 * a ativação autorizada (Portão 3 do checklist de go-live).
 *
 * Regras:
 * - HTTPS só para o host oficial de cada serviço (o host vem da região ou do
 *   nome do cofre, validados por padrão; nunca de texto livre);
 * - erros viram códigos (`VAULT_NOT_FOUND`, `VAULT_ACCESS_DENIED`,
 *   `VAULT_UNAVAILABLE`, `VAULT_BAD_RESPONSE`), nunca o corpo da resposta;
 * - o valor do segredo nunca vai para log nem para mensagem de erro.
 */
export interface HttpResponse {
  status: number;
  text(): Promise<string>;
}
export type HttpFetch = (
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<HttpResponse>;

export type VaultErrorCode = "VAULT_NOT_FOUND" | "VAULT_ACCESS_DENIED" | "VAULT_UNAVAILABLE" | "VAULT_BAD_RESPONSE" | "VAULT_CONFIG";
export class VaultError extends Error {
  constructor(readonly code: VaultErrorCode) {
    super(`Cofre de segredos: ${code}.`);
    this.name = "VaultError";
  }
}

export interface SecretStore {
  readonly provider: "aws-secrets-manager" | "azure-key-vault";
  getSecret(name: string): Promise<Buffer>;
}

const SECRET_NAME = /^[A-Za-z0-9/_+=.@-]{1,256}$/;
const TIMEOUT_MS = 10_000;

async function send(fetch: HttpFetch, url: string, init: Parameters<HttpFetch>[1]): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    return { status: r.status, body: await r.text() };
  } catch {
    throw new VaultError("VAULT_UNAVAILABLE");
  } finally {
    clearTimeout(t);
  }
}

function parseJson(body: string): Record<string, unknown> {
  try {
    const v = JSON.parse(body) as unknown;
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    /* cai no erro abaixo */
  }
  throw new VaultError("VAULT_BAD_RESPONSE");
}

// ------------------------------------------------------------------ AWS

export class AwsSecretsManagerStore implements SecretStore {
  readonly provider = "aws-secrets-manager" as const;
  private readonly host: string;
  constructor(
    private readonly cfg: { region: string; credentials: AwsCredentials; fetch: HttpFetch; now?: () => Date },
  ) {
    if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(cfg.region)) throw new VaultError("VAULT_CONFIG");
    if (!/^[A-Z0-9]{16,128}$/.test(cfg.credentials.accessKeyId) || !cfg.credentials.secretAccessKey)
      throw new VaultError("VAULT_CONFIG");
    this.host = `secretsmanager.${cfg.region}.amazonaws.com`;
  }
  async getSecret(name: string): Promise<Buffer> {
    if (!SECRET_NAME.test(name)) throw new VaultError("VAULT_CONFIG");
    const url = new URL(`https://${this.host}/`);
    const body = JSON.stringify({ SecretId: name });
    const headers = signAwsRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/x-amz-json-1.1", "x-amz-target": "secretsmanager.GetSecretValue" },
      body,
      region: this.cfg.region,
      service: "secretsmanager",
      credentials: this.cfg.credentials,
      now: this.cfg.now?.() ?? new Date(),
    });
    const r = await send(this.cfg.fetch, url.toString(), { method: "POST", headers, body });
    if (r.status >= 500) throw new VaultError("VAULT_UNAVAILABLE");
    if (r.status !== 200) {
      const type = String(parseJsonSafe(r.body).__type ?? "");
      if (/ResourceNotFound/.test(type)) throw new VaultError("VAULT_NOT_FOUND");
      if (r.status === 403 || /AccessDenied|UnrecognizedClient|InvalidSignature|ExpiredToken/.test(type))
        throw new VaultError("VAULT_ACCESS_DENIED");
      throw new VaultError("VAULT_BAD_RESPONSE");
    }
    const j = parseJson(r.body);
    if (typeof j.SecretBinary === "string") return Buffer.from(j.SecretBinary, "base64");
    if (typeof j.SecretString === "string") return Buffer.from(j.SecretString, "utf8");
    throw new VaultError("VAULT_BAD_RESPONSE");
  }
}

function parseJsonSafe(body: string): Record<string, unknown> {
  try {
    return parseJson(body);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- Azure

export class AzureKeyVaultStore implements SecretStore {
  readonly provider = "azure-key-vault" as const;
  private token: { value: string; expiresAt: number } | null = null;
  constructor(
    private readonly cfg: {
      tenantId: string;
      clientId: string;
      clientSecret: string;
      vaultName: string;
      fetch: HttpFetch;
      now?: () => number;
    },
  ) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(cfg.tenantId) || !uuid.test(cfg.clientId) || !cfg.clientSecret) throw new VaultError("VAULT_CONFIG");
    if (!/^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$/.test(cfg.vaultName)) throw new VaultError("VAULT_CONFIG");
  }
  private now() {
    return this.cfg.now?.() ?? Date.now();
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: "https://vault.azure.net/.default",
    }).toString();
    const r = await send(this.cfg.fetch, `https://login.microsoftonline.com/${this.cfg.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (r.status >= 500) throw new VaultError("VAULT_UNAVAILABLE");
    if (r.status !== 200) throw new VaultError("VAULT_ACCESS_DENIED");
    const j = parseJson(r.body);
    if (typeof j.access_token !== "string") throw new VaultError("VAULT_BAD_RESPONSE");
    const ttl = typeof j.expires_in === "number" ? j.expires_in : Number(j.expires_in ?? 0);
    this.token = { value: j.access_token, expiresAt: this.now() + Math.max(ttl, 0) * 1000 };
    return this.token.value;
  }
  async getSecret(name: string): Promise<Buffer> {
    // Nome de segredo do Key Vault: letras, números e hífen.
    if (!/^[A-Za-z0-9-]{1,127}$/.test(name)) throw new VaultError("VAULT_CONFIG");
    const token = await this.accessToken();
    const r = await send(
      this.cfg.fetch,
      `https://${this.cfg.vaultName}.vault.azure.net/secrets/${encodeURIComponent(name)}?api-version=7.4`,
      { method: "GET", headers: { authorization: `Bearer ${token}` } },
    );
    if (r.status >= 500) throw new VaultError("VAULT_UNAVAILABLE");
    if (r.status === 404) throw new VaultError("VAULT_NOT_FOUND");
    if (r.status === 401 || r.status === 403) {
      this.token = null;
      throw new VaultError("VAULT_ACCESS_DENIED");
    }
    if (r.status !== 200) throw new VaultError("VAULT_BAD_RESPONSE");
    const j = parseJson(r.body);
    if (typeof j.value !== "string") throw new VaultError("VAULT_BAD_RESPONSE");
    return Buffer.from(j.value, "utf8");
  }
}
