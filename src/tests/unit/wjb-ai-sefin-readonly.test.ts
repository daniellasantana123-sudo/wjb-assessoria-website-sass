import { execFileSync, spawnSync } from "node:child_process";
import { createPrivateKey, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  checkReadOnlyRequest,
  SefinReadRefusedError,
  sefinReadOnly,
  type ReadAuthorization,
} from "@/lib/wjb-ai/fiscal/national/sefin-readonly";
import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";

/**
 * mTLS e travas de somente leitura testados contra um servidor LOCAL que
 * exige certificado de cliente (CA, servidor e cliente fictícios gerados na
 * hora). Nenhum acesso ao governo.
 */
const hasOpenssl =
  spawnSync("openssl", ["version"], { stdio: "ignore" }).status === 0;
const AUTH: ReadAuthorization = {
  approvedBy: "Diretoria WJB (teste)",
  approvedAt: "2026-11-21",
  scope: "leitura-documentacao-e-consulta",
};
let dir = "";
let server: Server;
let port = 0;
let ca: Buffer;
let client: SigningMaterial;
let stranger: SigningMaterial;
const seen: { method: string; url: string; clientCn: string | null }[] = [];

function sh(args: string[]) {
  execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
}

beforeAll(async () => {
  if (!hasOpenssl) return;
  dir = mkdtempSync(path.join(tmpdir(), "wjb-mtls-"));
  sh([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.crt",
    "-days",
    "2",
    "-subj",
    "/CN=AC FICTICIA DE TESTE",
  ]);
  writeFileSync(
    path.join(dir, "srv.ext"),
    "subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n",
  );
  sh([
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "srv.key",
    "-out",
    "srv.csr",
    "-subj",
    "/CN=localhost",
  ]);
  sh([
    "x509",
    "-req",
    "-in",
    "srv.csr",
    "-CA",
    "ca.crt",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    "srv.crt",
    "-days",
    "2",
    "-extfile",
    "srv.ext",
  ]);
  writeFileSync(
    path.join(dir, "cli.ext"),
    "extendedKeyUsage=clientAuth\nkeyUsage=critical,digitalSignature,nonRepudiation\n",
  );
  sh([
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "cli.key",
    "-out",
    "cli.csr",
    "-subj",
    "/CN=EMPRESA FICTICIA:00000000000191",
  ]);
  sh([
    "x509",
    "-req",
    "-in",
    "cli.csr",
    "-CA",
    "ca.crt",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    "cli.crt",
    "-days",
    "2",
    "-extfile",
    "cli.ext",
  ]);
  sh([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "x.key",
    "-out",
    "x.crt",
    "-days",
    "2",
    "-subj",
    "/CN=ESTRANHO",
  ]);
  ca = readFileSync(path.join(dir, "ca.crt"));
  const load = (k: string, c: string): SigningMaterial => ({
    privateKey: createPrivateKey(readFileSync(path.join(dir, k))),
    certificateDer: new X509Certificate(readFileSync(path.join(dir, c))).raw,
  });
  client = load("cli.key", "cli.crt");
  stranger = load("x.key", "x.crt");
  server = createServer(
    {
      key: readFileSync(path.join(dir, "srv.key")),
      cert: readFileSync(path.join(dir, "srv.crt")),
      ca,
      requestCert: true,
      rejectUnauthorized: true,
    },
    (req, res) => {
      const peer = (
        req.socket as unknown as {
          getPeerCertificate(): { subject?: { CN?: string } };
        }
      ).getPeerCertificate();
      seen.push({
        method: req.method ?? "",
        url: req.url ?? "",
        clientCn: peer?.subject?.CN ?? null,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        req.method === "HEAD"
          ? undefined
          : JSON.stringify({ openapi: "3.0.1", info: { title: "fictício" } }),
      );
    },
  );
  await new Promise<void>((r) => server.listen(0, "localhost", () => r()));
  port = (server.address() as { port: number }).port;
});
afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (dir) rmSync(dir, { recursive: true, force: true });
});
afterEach(() => {
  delete process.env.WJB_AI_SEFIN_READ_AUTHORIZED;
});

describe("travas de somente leitura (sem rede)", () => {
  const u = (p: string, h = "sefin.producaorestrita.nfse.gov.br") =>
    new URL(`https://${h}${p}`);
  it("permite só GET de documentação e HEAD /dps em produção restrita", () => {
    expect(() =>
      checkReadOnlyRequest("GET", u("/API/SefinNacional/docs")),
    ).not.toThrow();
    expect(() =>
      checkReadOnlyRequest(
        "GET",
        u("/API/SefinNacional/swagger/v1/swagger.json"),
      ),
    ).not.toThrow();
    expect(() =>
      checkReadOnlyRequest(
        "HEAD",
        u(`/API/SefinNacional/dps/DPS${"1".repeat(42)}`),
      ),
    ).not.toThrow();
  });
  it("recusa emissão, eventos, consulta de nota, produção e outros hosts", () => {
    for (const [m, url] of [
      ["POST", u("/API/SefinNacional/nfse")],
      ["POST", u("/API/SefinNacional/nfse/123/eventos")],
      ["GET", u("/API/SefinNacional/nfse/123")],
      ["GET", u(`/API/SefinNacional/dps/DPS${"1".repeat(42)}`)],
      ["DELETE", u("/API/SefinNacional/docs")],
      ["GET", u("/SefinNacional/docs", "sefin.nfse.gov.br")],
      ["GET", u("/docs", "exemplo.com")],
    ] as const)
      expect(() => checkReadOnlyRequest(m, url), `${m} ${url}`).toThrow(
        SefinReadRefusedError,
      );
  });
});

describe.skipIf(!hasOpenssl)(
  "mTLS contra servidor local que exige certificado de cliente",
  () => {
    const base = () => `https://localhost:${port}`;
    const overrides = () => ({ allowedHosts: ["localhost"], ca });

    it("sem a variável de autorização, nem abre conexão", async () => {
      const before = seen.length;
      await expect(
        sefinReadOnly({
          method: "GET",
          url: `${base()}/API/SefinNacional/docs`,
          authorization: AUTH,
          material: client,
          testOverrides: overrides(),
        }),
      ).rejects.toThrow(/não autorizada/);
      expect(seen.length).toBe(before);
    });

    it("sem autorização expressa registrada, recusa", async () => {
      process.env.WJB_AI_SEFIN_READ_AUTHORIZED = "true";
      await expect(
        sefinReadOnly({
          method: "GET",
          url: `${base()}/API/SefinNacional/docs`,
          authorization: null,
          material: client,
          testOverrides: overrides(),
        }),
      ).rejects.toThrow(/autorização expressa/);
    });

    it("autorizado: lê a documentação com certificado de cliente e devolve hash, sem logar o corpo", async () => {
      process.env.WJB_AI_SEFIN_READ_AUTHORIZED = "true";
      const r = await sefinReadOnly({
        method: "GET",
        url: `${base()}/API/SefinNacional/swagger/v1/swagger.json`,
        authorization: AUTH,
        material: client,
        testOverrides: overrides(),
      });
      expect(r.status).toBe(200);
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.parse(r.body.toString()).openapi).toBe("3.0.1");
      expect(seen.at(-1)).toMatchObject({
        method: "GET",
        clientCn: "EMPRESA FICTICIA:00000000000191",
      });
    });

    it("HEAD /dps funciona (consulta sem efeito fiscal)", async () => {
      process.env.WJB_AI_SEFIN_READ_AUTHORIZED = "true";
      const r = await sefinReadOnly({
        method: "HEAD",
        url: `${base()}/API/SefinNacional/dps/DPS${"3".repeat(42)}`,
        authorization: AUTH,
        material: client,
        testOverrides: overrides(),
      });
      expect(r.status).toBe(200);
      expect(seen.at(-1)?.method).toBe("HEAD");
    });

    it("emissão é recusada antes de abrir conexão, mesmo autorizado", async () => {
      process.env.WJB_AI_SEFIN_READ_AUTHORIZED = "true";
      const before = seen.length;
      await expect(
        sefinReadOnly({
          method: "GET" as never,
          url: `${base()}/API/SefinNacional/nfse`,
          authorization: AUTH,
          material: client,
          testOverrides: overrides(),
        }),
      ).rejects.toThrow(SefinReadRefusedError);
      expect(seen.length).toBe(before);
    });

    it("certificado de cliente fora da cadeia confiável é recusado pelo servidor (handshake falha)", async () => {
      process.env.WJB_AI_SEFIN_READ_AUTHORIZED = "true";
      await expect(
        sefinReadOnly({
          method: "GET",
          url: `${base()}/API/SefinNacional/docs`,
          authorization: AUTH,
          material: stranger,
          testOverrides: overrides(),
        }),
      ).rejects.toThrow();
    });
  },
);
