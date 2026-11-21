import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Procedimento local de verificação do certificado
 * (scripts/wjb-ai/certificado/verificar-certificado.mjs), testado com
 * certificados FICTÍCIOS gerados na hora (não ICP-Brasil), fora do repositório.
 * Nenhum certificado real é usado.
 */
const hasOpenssl3 = /OpenSSL 3\./.test(
  spawnSync("openssl", ["version"], { encoding: "utf8" }).stdout ?? "",
);
const SCRIPT = path.join(
  process.cwd(),
  "scripts/wjb-ai/certificado/verificar-certificado.mjs",
);
const CNPJ = "00000000000191"; // fictício
const CPF = "52998224725"; // fictício (dígitos válidos)
const PASS = "senha-ficticia-123";
let dir = "";

function makePfx(name: string, otherNames: string[], legacy = false) {
  writeFileSync(
    path.join(dir, `${name}.cnf`),
    `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=FULANA DE TAL FICTICIA:${CPF}\n[ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation,keyEncipherment\nextendedKeyUsage=clientAuth,emailProtection\nsubjectAltName=${otherNames.join(",")}\n`,
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      `${name}.key`,
      "-out",
      `${name}.crt`,
      "-days",
      "90",
      "-config",
      `${name}.cnf`,
      "-extensions",
      "ext",
    ],
    { cwd: dir, stdio: "ignore" },
  );
  execFileSync(
    "openssl",
    [
      "pkcs12",
      "-export",
      "-inkey",
      `${name}.key`,
      "-in",
      `${name}.crt`,
      "-out",
      `${name}.pfx`,
      "-passout",
      `pass:${PASS}`,
      ...(legacy ? ["-legacy"] : []),
    ],
    { cwd: dir, stdio: "ignore" },
  );
  rmSync(path.join(dir, `${name}.key`)); // a chave só existe dentro do PFX
  return path.join(dir, `${name}.pfx`);
}

function run(pfx: string, password = PASS, extra: string[] = []) {
  const out = path.join(dir, `rel-${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(
    "node",
    [SCRIPT, pfx, "--cnpj-esperado", CNPJ, "--saida", out, ...extra],
    {
      input: `${password}\n`,
      encoding: "utf8",
    },
  );
  let report: Record<string, unknown> | null = null;
  try {
    report = JSON.parse(readFileSync(out, "utf8"));
  } catch {
    /* sem relatório */
  }
  return { ...r, report, raw: report ? readFileSync(out, "utf8") : "" };
}

beforeAll(() => {
  if (!hasOpenssl3) return;
  dir = mkdtempSync(path.join(tmpdir(), "wjb-pfx-"));
});
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const ecnpj = () =>
  makePfx("ecnpj", [
    `otherName:2.16.76.1.3.4;UTF8:01011980${CPF}000000000000000000000000000000000`,
    "otherName:2.16.76.1.3.2;UTF8:FULANA DE TAL FICTICIA",
    `otherName:2.16.76.1.3.3;UTF8:${CNPJ}`,
  ]);

describe.skipIf(!hasOpenssl3)(
  "verificação local do certificado (fictício)",
  () => {
    it("e-CNPJ: identifica o tipo, confere o CNPJ, lê requisitos e mascara dados pessoais", () => {
      const r = run(ecnpj());
      expect(r.status).toBe(0);
      expect(r.report).toMatchObject({
        tipo: "e-CNPJ",
        cnpjConfere: true,
        clientAuth: true,
        ehAC: false,
        keyUsage: { assinaturaDigital: true, naoRecusa: true },
        titularOuResponsavel: {
          cpf: "***.982.247-**",
          iniciais: "F. D. T. F.",
        },
        pfx: { lidoPeloNode: true },
      });
      // Nada de material privado, senha, CPF completo ou nome completo.
      for (const forbidden of [
        PASS,
        CPF,
        "FULANA DE TAL",
        "PRIVATE KEY",
        "BEGIN CERTIFICATE",
      ])
        expect(r.raw + r.stdout).not.toContain(forbidden);
      // AC fictícia: a verificação de emissor ICP-Brasil reprova, como deve.
      const icp = (
        r.report!.verificacoes as { item: string; ok: boolean }[]
      ).find((v) => v.item === "Emitido por AC ICP-Brasil");
      expect(icp?.ok).toBe(false);
    });

    it("e-CPF: identificado como certificado pessoal e CNPJ 'não se aplica'", () => {
      const r = run(
        makePfx("ecpf", [
          `otherName:2.16.76.1.3.1;UTF8:01011980${CPF}0000000000000000000000000000000`,
        ]),
      );
      expect(r.report).toMatchObject({
        tipo: "e-CPF",
        cnpjConfere: false,
        cnpjDoCertificado: null,
      });
      expect(r.raw).not.toContain(CPF);
    });

    it("e-CNPJ de outra empresa: CNPJ não confere", () => {
      const pfx = makePfx("outra", [
        `otherName:2.16.76.1.3.3;UTF8:11222333000181`,
      ]);
      const r = run(pfx);
      expect(r.report).toMatchObject({ tipo: "e-CNPJ", cnpjConfere: false });
    });

    it("PFX com criptografia legada (RC2/3DES) é lido pelo OpenSSL, mas sinalizado", () => {
      const r = run(
        makePfx("legado", [`otherName:2.16.76.1.3.3;UTF8:${CNPJ}`], true),
      );
      expect(r.status).toBe(0);
      expect(
        (r.report!.pfx as { criptografiaLegada: boolean }).criptografiaLegada,
      ).toBe(true);
    });

    it("senha errada: para sem relatório e sem mostrar a senha", () => {
      const r = run(ecnpj(), "errada");
      expect(r.status).toBe(1);
      expect(r.report).toBeNull();
      expect(r.stderr).toMatch(/Senha incorreta/);
      expect(r.stdout + r.stderr).not.toContain("errada\n");
    });

    it("recusa PFX de dentro do repositório", () => {
      const r = spawnSync(
        "node",
        [SCRIPT, path.join(process.cwd(), "package.json")],
        { input: "x\n", encoding: "utf8" },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/dentro da pasta do projeto/);
    });
  },
);
