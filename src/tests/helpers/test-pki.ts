import { execFileSync, spawnSync } from "node:child_process";
import { createPrivateKey, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";

/**
 * PKI de TESTE (Fase 10B). Tudo fictício, gerado na hora num diretório
 * temporário e apagado no fim: nenhuma relação com a ICP-Brasil e nenhum
 * certificado real. Nunca usar fora dos testes.
 */
export const opensslAvailable =
  spawnSync("openssl", ["version"], { stdio: "ignore" }).status === 0;

export interface LeafOptions {
  /** OtherName CNPJ (2.16.76.1.3.3). */
  cnpj?: string;
  /** OtherName CPF (2.16.76.1.3.1): 8 dígitos de data + 11 do CPF fictício. */
  cpf?: string;
  bits?: number;
  digest?: "sha256" | "sha1";
  /** AAAAMMDDHHMMSSZ. */
  notBefore?: string;
  /** AAAAMMDDHHMMSSZ. Com ele, `days` é ignorado (no OpenSSL, -days conta de hoje). */
  notAfter?: string;
  days?: number;
  issuer?: "ca" | "outra-ca";
  /** Emite um certificado de AC no lugar do de usuário final. */
  ca?: boolean;
  /** Omite a Autenticação de Cliente (clientAuth). */
  noClientAuth?: boolean;
}

export interface TestPki {
  dir: string;
  caPem: string;
  otherCaPem: string;
  ca: X509Certificate;
  otherCa: X509Certificate;
  leaf(
    name: string,
    opts: LeafOptions,
  ): {
    pem: string;
    x509: X509Certificate;
    material: SigningMaterial;
  };
  dispose(): void;
}

function run(dir: string, args: string[]) {
  execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
}

function makeCa(dir: string, name: string) {
  writeFileSync(
    path.join(dir, `${name}.cnf`),
    `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=AC ${name} FICTICIA DE TESTE\n[ext]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n`,
  );
  run(dir, [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    `${name}.key`,
    "-out",
    `${name}.pem`,
    "-days",
    "365",
    "-not_before",
    "20260101000000Z",
    "-config",
    `${name}.cnf`,
    "-extensions",
    "ext",
  ]);
  return readFileSync(path.join(dir, `${name}.pem`), "utf8");
}

export function createTestPki(): TestPki {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-pki-"));
  const caPem = makeCa(dir, "ca");
  const otherCaPem = makeCa(dir, "outra-ca");
  return {
    dir,
    caPem,
    otherCaPem,
    ca: new X509Certificate(caPem),
    otherCa: new X509Certificate(otherCaPem),
    leaf(name, opts) {
      const san = [
        opts.cnpj ? `otherName:2.16.76.1.3.3;OCTETSTRING:${opts.cnpj}` : null,
        opts.cpf ? `otherName:2.16.76.1.3.1;OCTETSTRING:${opts.cpf}` : null,
      ]
        .filter(Boolean)
        .join(",");
      writeFileSync(
        path.join(dir, `${name}.cnf`),
        `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=${name} FICTICIO\n[ext]\nbasicConstraints=critical,CA:${opts.ca ? "TRUE" : "FALSE"}\nkeyUsage=critical,digitalSignature,nonRepudiation${opts.ca ? ",keyCertSign" : ""}\nextendedKeyUsage=${opts.noClientAuth ? "emailProtection" : "clientAuth"}\n${san ? `subjectAltName=${san}\n` : ""}`,
      );
      run(dir, [
        "req",
        "-new",
        "-newkey",
        `rsa:${opts.bits ?? 2048}`,
        "-nodes",
        "-keyout",
        `${name}.key`,
        "-out",
        `${name}.csr`,
        "-config",
        `${name}.cnf`,
      ]);
      const issuer = opts.issuer ?? "ca";
      run(dir, [
        "x509",
        "-req",
        "-in",
        `${name}.csr`,
        "-CA",
        `${issuer}.pem`,
        "-CAkey",
        `${issuer}.key`,
        "-set_serial",
        String(Math.floor(Math.random() * 1e9)),
        `-${opts.digest ?? "sha256"}`,
        "-not_before",
        opts.notBefore ?? todayStamp(),
        ...(opts.notAfter
          ? ["-not_after", opts.notAfter]
          : ["-days", String(opts.days ?? 60)]),
        "-extfile",
        `${name}.cnf`,
        "-extensions",
        "ext",
        "-out",
        `${name}.pem`,
      ]);
      const pem = readFileSync(path.join(dir, `${name}.pem`), "utf8");
      const x509 = new X509Certificate(pem);
      return {
        pem,
        x509,
        material: {
          privateKey: createPrivateKey(
            readFileSync(path.join(dir, `${name}.key`)),
          ),
          certificateDer: x509.raw,
        },
      };
    },
    dispose() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Agora menos 1 minuto (UTC), no formato do OpenSSL. */
export function todayStamp(): string {
  return `${new Date(Date.now() - 60_000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-T:]/g, "")}Z`;
}
