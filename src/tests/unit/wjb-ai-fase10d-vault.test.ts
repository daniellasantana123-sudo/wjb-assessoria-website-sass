import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CertificateVaultNotConfiguredError,
  createCertificateVault,
} from "@/lib/wjb-ai/fiscal/certificate-vault";
import { signAwsRequest } from "@/lib/wjb-ai/fiscal/vault/aws-sigv4";
import {
  AwsSecretsManagerStore,
  AzureKeyVaultStore,
  VaultError,
  type HttpFetch,
  type SecretStore,
} from "@/lib/wjb-ai/fiscal/vault/secret-stores";
import {
  materialFromSecrets,
  parseVaultReference,
  SecretsManagerCertificateVault,
} from "@/lib/wjb-ai/fiscal/vault/secrets-manager-vault";
import { createTestPki, opensslAvailable, type TestPki } from "@/tests/helpers/test-pki";

// Credenciais FICTÍCIAS (as de exemplo da própria documentação da AWS).
const AWS = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const SECRET_VALUE = "valor-secreto-ficticio-nao-pode-vazar";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
function fakeFetch(respond: (c: Call) => { status: number; body: string } | Error) {
  const calls: Call[] = [];
  const fetch: HttpFetch = async (url, init) => {
    const c = { url, method: init.method, headers: init.headers, body: init.body };
    calls.push(c);
    const r = respond(c);
    if (r instanceof Error) throw r;
    return { status: r.status, text: async () => r.body };
  };
  return { fetch, calls };
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    expect(String((e as Error).message)).not.toContain(SECRET_VALUE);
    return e instanceof VaultError ? e.code : `outro:${(e as Error).name}`;
  }
};

describe("AWS Signature Version 4", () => {
  it("bate com o exemplo publicado pela AWS (IAM ListUsers, 20150830T123600Z)", () => {
    const h = signAwsRequest({
      method: "GET",
      url: new URL("https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08"),
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: "",
      region: "us-east-1",
      service: "iam",
      credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" },
      now: new Date("2015-08-30T12:36:00Z"),
    });
    expect(h.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
  });
});

describe("AWS Secrets Manager (cliente HTTP falso, sem rede)", () => {
  const store = (respond: Parameters<typeof fakeFetch>[0]) => {
    const f = fakeFetch(respond);
    return { s: new AwsSecretsManagerStore({ region: "sa-east-1", credentials: AWS, fetch: f.fetch, now: () => new Date("2026-11-26T12:00:00Z") }), calls: f.calls };
  };
  it("chama só o host oficial da região, com GetSecretValue assinado", async () => {
    const { s, calls } = store(() => ({ status: 200, body: JSON.stringify({ SecretString: SECRET_VALUE }) }));
    expect((await s.getSecret("wjb-ecnpj")).toString()).toBe(SECRET_VALUE);
    expect(calls[0].url).toBe("https://secretsmanager.sa-east-1.amazonaws.com/");
    expect(calls[0].headers["x-amz-target"]).toBe("secretsmanager.GetSecretValue");
    expect(calls[0].headers["content-type"]).toBe("application/x-amz-json-1.1");
    expect(calls[0].headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20261126\/sa-east-1\/secretsmanager\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/);
    expect(JSON.parse(calls[0].body!)).toEqual({ SecretId: "wjb-ecnpj" });
    expect(JSON.stringify(calls)).not.toContain(AWS.secretAccessKey);
  });
  it("SecretBinary vem em base64", async () => {
    const { s } = store(() => ({ status: 200, body: JSON.stringify({ SecretBinary: Buffer.from("abc").toString("base64") }) }));
    expect((await s.getSecret("x-y")).toString()).toBe("abc");
  });
  it("erros viram códigos, nunca o corpo da resposta", async () => {
    const cases: [Parameters<typeof fakeFetch>[0], string][] = [
      [() => ({ status: 400, body: JSON.stringify({ __type: "ResourceNotFoundException", message: SECRET_VALUE }) }), "VAULT_NOT_FOUND"],
      [() => ({ status: 400, body: JSON.stringify({ __type: "AccessDeniedException", message: SECRET_VALUE }) }), "VAULT_ACCESS_DENIED"],
      [() => ({ status: 403, body: SECRET_VALUE }), "VAULT_ACCESS_DENIED"],
      [() => ({ status: 503, body: SECRET_VALUE }), "VAULT_UNAVAILABLE"],
      [() => new Error("rede"), "VAULT_UNAVAILABLE"],
      [() => ({ status: 200, body: "não é json " + SECRET_VALUE }), "VAULT_BAD_RESPONSE"],
      [() => ({ status: 200, body: JSON.stringify({ Name: "sem valor" }) }), "VAULT_BAD_RESPONSE"],
    ];
    for (const [respond, expected] of cases) expect(await code(store(respond).s.getSecret("abc"))).toBe(expected);
  });
  it("configuração inválida é recusada antes de qualquer chamada (região, chave, nome)", async () => {
    const f = fakeFetch(() => ({ status: 200, body: "{}" }));
    expect(() => new AwsSecretsManagerStore({ region: "evil.com/", credentials: AWS, fetch: f.fetch })).toThrow(VaultError);
    expect(() => new AwsSecretsManagerStore({ region: "sa-east-1", credentials: { ...AWS, accessKeyId: "x" }, fetch: f.fetch })).toThrow(VaultError);
    const s = new AwsSecretsManagerStore({ region: "sa-east-1", credentials: AWS, fetch: f.fetch });
    expect(await code(s.getSecret("nome com espaço"))).toBe("VAULT_CONFIG");
    expect(f.calls).toHaveLength(0);
  });
});

describe("Azure Key Vault (cliente HTTP falso, sem rede)", () => {
  const T = "11111111-2222-4333-8444-555555555555";
  const C = "66666666-7777-4888-8999-000000000000";
  const make = (respond: Parameters<typeof fakeFetch>[0], now = () => 1_000_000) => {
    const f = fakeFetch(respond);
    return { s: new AzureKeyVaultStore({ tenantId: T, clientId: C, clientSecret: "segredo-ficticio", vaultName: "wjb-cofre-teste", fetch: f.fetch, now }), calls: f.calls };
  };
  const ok = (c: Call) =>
    c.url.includes("login.microsoftonline.com")
      ? { status: 200, body: JSON.stringify({ access_token: "tok-ficticio", expires_in: 3600 }) }
      : { status: 200, body: JSON.stringify({ value: SECRET_VALUE }) };
  it("pede token só ao login oficial e lê o segredo do host do cofre; reaproveita o token", async () => {
    const { s, calls } = make(ok);
    await s.getSecret("wjb-ecnpj");
    await s.getSecret("wjb-ecnpj-senha");
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["login.microsoftonline.com", "wjb-cofre-teste.vault.azure.net", "wjb-cofre-teste.vault.azure.net"]);
    expect(calls[0].body).toContain("scope=https%3A%2F%2Fvault.azure.net%2F.default");
    expect(calls[1].url).toMatch(/\/secrets\/wjb-ecnpj\?api-version=7\.4$/);
    expect(calls[1].headers.authorization).toBe("Bearer tok-ficticio");
  });
  it("401/403 descarta o token; 404, 5xx e corpo ruim viram códigos", async () => {
    const seq = make((c) => (c.url.includes("login") ? ok(c) : { status: 403, body: SECRET_VALUE }));
    expect(await code(seq.s.getSecret("a-b"))).toBe("VAULT_ACCESS_DENIED");
    await code(seq.s.getSecret("a-b"));
    expect(seq.calls.filter((c) => c.url.includes("login"))).toHaveLength(2);
    expect(await code(make((c) => (c.url.includes("login") ? ok(c) : { status: 404, body: "" })).s.getSecret("a-b"))).toBe("VAULT_NOT_FOUND");
    expect(await code(make((c) => (c.url.includes("login") ? ok(c) : { status: 500, body: "" })).s.getSecret("a-b"))).toBe("VAULT_UNAVAILABLE");
    expect(await code(make(() => ({ status: 400, body: SECRET_VALUE })).s.getSecret("a-b"))).toBe("VAULT_ACCESS_DENIED");
  });
  it("cofre e nome fora do padrão são recusados (sem SSRF por nome)", async () => {
    const f = fakeFetch(ok);
    expect(() => new AzureKeyVaultStore({ tenantId: T, clientId: C, clientSecret: "x", vaultName: "evil.com#", fetch: f.fetch })).toThrow(VaultError);
    expect(await code(make(ok).s.getSecret("../outro"))).toBe("VAULT_CONFIG");
  });
});

describe.skipIf(!opensslAvailable)("material do certificado lido do cofre", () => {
  let pki: TestPki;
  beforeAll(() => {
    pki = createTestPki();
  });
  afterAll(() => pki?.dispose());
  const secrets = (opts: { encrypt?: boolean; otherKey?: boolean } = {}) => {
    const leaf = pki.leaf("cofre-leaf", { cnpj: "11222333000181" });
    const keySource = opts.otherKey ? pki.leaf("cofre-outra", { cnpj: "11222333000181" }).material.privateKey : leaf.material.privateKey;
    const privateKeyPem =
      opts.encrypt === false
        ? (keySource.export({ type: "pkcs8", format: "pem" }) as string)
        : (keySource.export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: "senha-ficticia" }) as string);
    return { leaf, json: Buffer.from(JSON.stringify({ format: "wjb-cert-v1", certificatePem: leaf.pem, privateKeyPem })) };
  };
  it("abre a chave cifrada com a senha e confere que ela é do certificado", () => {
    const { leaf, json } = secrets();
    const m = materialFromSecrets(json, Buffer.from("senha-ficticia"));
    expect(m.certificateDer.equals(leaf.x509.raw)).toBe(true);
    expect(m.privateKey.type).toBe("private");
  });
  it("recusa chave sem cifra, senha errada e chave de outro certificado", () => {
    expect(() => materialFromSecrets(secrets({ encrypt: false }).json, Buffer.from("x"))).toThrow(VaultError);
    expect(() => materialFromSecrets(secrets().json, Buffer.from("senha-errada"))).toThrow(VaultError);
    expect(() => materialFromSecrets(secrets({ otherKey: true }).json, Buffer.from("senha-ficticia"))).toThrow(VaultError);
    expect(() => materialFromSecrets(Buffer.from("{}"), Buffer.from("x"))).toThrow(VaultError);
  });
  it("o cofre lê o par de segredos pela referência e só do provedor configurado", async () => {
    const { json } = secrets();
    const read: string[] = [];
    const store: SecretStore = {
      provider: "aws-secrets-manager",
      getSecret: async (n) => {
        read.push(n);
        return n.endsWith("-senha") ? Buffer.from("senha-ficticia") : json;
      },
    };
    const vault = new SecretsManagerCertificateVault(store, "aws");
    expect(vault.kind).toBe("gerenciador-de-segredos");
    await vault.load("vault://aws/wjb-ecnpj-2026");
    expect(read.sort()).toEqual(["wjb-ecnpj-2026", "wjb-ecnpj-2026-senha"]);
    await expect(vault.load("vault://azure/wjb-ecnpj-2026")).rejects.toThrow(VaultError);
    await expect(vault.load("vault://teste/x")).rejects.toThrow(VaultError);
    expect(() => new SecretsManagerCertificateVault(store, "azure")).toThrow(VaultError);
  });
});

describe("ativação continua bloqueada", () => {
  it("referências válidas e inválidas", () => {
    expect(parseVaultReference("vault://azure/wjb-ecnpj")).toEqual({ provider: "azure", name: "wjb-ecnpj" });
    expect(() => parseVaultReference("vault://aws/../x")).toThrow(VaultError);
  });
  it("a fábrica do cofre ainda recusa: nenhum serviço contratado", () => {
    expect(() => createCertificateVault()).toThrow(CertificateVaultNotConfiguredError);
  });
});
