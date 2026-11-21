#!/usr/bin/env node
/**
 * Verificação LOCAL de um certificado ICP-Brasil A1 (.pfx/.p12), sem rede.
 *
 * Feito para a responsável pela empresa rodar NO PRÓPRIO COMPUTADOR. Nada é
 * enviado a lugar nenhum: nem o arquivo, nem a senha, nem o relatório.
 *
 *   node scripts/wjb-ai/certificado/verificar-certificado.mjs <arquivo.pfx> [opções]
 *
 * Opções:
 *   --cnpj-esperado <cnpj>   CNPJ que o certificado deveria ter (padrão: o CNPJ
 *                            público da WJB em src/config/site.ts)
 *   --cadeia <arquivo.pem>   certificados públicos da cadeia ICP-Brasil (AC Raiz
 *                            e intermediárias, baixados do ITI/AC) para conferir
 *                            a cadeia com `openssl verify`
 *   --saida <arquivo.json>   grava o relatório (sem dados pessoais completos)
 *   --verificar-revogacao    baixa a LCR indicada no próprio certificado (acessa o
 *                            servidor da Autoridade Certificadora). Desligado por
 *                            padrão: sem isso, a revogação fica "não verificada".
 *
 * Garantias:
 * - a senha é digitada sem eco e só existe em memória;
 * - a chave privada NUNCA é exportada, impressa ou gravada: a conferência
 *   chave x certificado é feita dentro do Node (tls.createSecureContext);
 * - o certificado em si não é gravado (contém nome e CPF);
 * - CPF e nome saem mascarados no relatório; CNPJ de empresa é dado público;
 * - recusa arquivo .pfx de dentro do repositório (para não ir ao GitHub).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { X509Certificate, createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { createSecureContext } from "node:tls";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);
const WITH_VALUE = new Set(["--cnpj-esperado", "--cadeia", "--saida"]);
const file = args.find(
  (a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1]),
);

function die(msg) {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(1);
}

if (!file) die("Informe o caminho do arquivo .pfx.");
const pfxPath = path.resolve(file);
if (!existsSync(pfxPath)) die("Arquivo não encontrado.");
if (pfxPath.startsWith(ROOT + path.sep))
  die(
    "O arquivo está dentro da pasta do projeto. Mova para fora (ex.: Documentos) para nunca ir ao GitHub.",
  );

const ossl = spawnSync("openssl", ["version"], { encoding: "utf8" });
if (ossl.status !== 0 || !/OpenSSL 3\./.test(ossl.stdout))
  die(
    "É preciso OpenSSL 3 instalado (o LibreSSL do macOS não lê todos os PFX).",
  );

const expectedCnpj = (
  opt("--cnpj-esperado") ??
  readFileSync(path.join(ROOT, "src/config/site.ts"), "utf8").match(
    /cnpj:\s*"([^"]+)"/,
  )?.[1] ??
  ""
).replace(/\D/g, "");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const onData = (c) => {
      if (["\n", "\r", "\u0004"].includes(c.toString())) return;
      process.stdout.write(`\x1b[2K\x1b[200D${question}`);
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.off("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

/** openssl pkcs12 lendo a senha pelo stdin (nunca em argumento ou variável). */
function pkcs12(extra, password) {
  for (const legacy of [false, true]) {
    const r = spawnSync(
      "openssl",
      [
        "pkcs12",
        "-in",
        pfxPath,
        "-passin",
        "stdin",
        ...(legacy ? ["-legacy"] : []),
        ...extra,
      ],
      {
        input: `${password}\n`,
        encoding: "utf8",
      },
    );
    if (r.status === 0) return { out: r.stdout, info: r.stderr, legacy };
    if (/mac verify failure|invalid password/i.test(r.stderr))
      die("Senha incorreta (ou arquivo corrompido).");
  }
  die("Não foi possível ler o PFX com o OpenSSL.");
}

// ---------- leitor DER mínimo (só extensões públicas) ----------
function tlv(buf, pos) {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let start = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + buf[pos + 2 + k];
    start = pos + 2 + n;
  }
  return { tag, start, end: start + len };
}
const kids = (buf, t) => {
  const out = [];
  for (let p = t.start; p < t.end;) {
    const c = tlv(buf, p);
    out.push(c);
    p = c.end;
  }
  return out;
};
function oid(bytes) {
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let v = 0;
  for (let k = 1; k < bytes.length; k++) {
    v = v * 128 + (bytes[k] & 0x7f);
    if (!(bytes[k] & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}
function extValue(der, oidBytes) {
  const at = der.indexOf(Buffer.from(oidBytes));
  if (at < 0) return null;
  let t = tlv(der, at + oidBytes.length);
  if (t.tag === 0x01) t = tlv(der, t.end);
  return t.tag === 0x04 ? der.subarray(t.start, t.end) : null;
}
function otherNames(der) {
  const san = extValue(der, [0x06, 0x03, 0x55, 0x1d, 0x11]);
  const out = {};
  if (!san) return out;
  for (const gn of kids(san, tlv(san, 0))) {
    if (gn.tag !== 0xa0) continue;
    const [o, v] = kids(san, gn);
    if (!o || !v) continue;
    const inner = v.tag === 0xa0 ? tlv(san, v.start) : v;
    out[oid(san.subarray(o.start, o.end))] = san
      .subarray(inner.start, inner.end)
      .toString("latin1")
      .trim();
  }
  return out;
}
function keyUsage(der) {
  const ku = extValue(der, [0x06, 0x03, 0x55, 0x1d, 0x0f]);
  if (!ku) return { assinaturaDigital: false, naoRecusa: false };
  const b = tlv(ku, 0);
  const first = ku[b.start + 1] ?? 0;
  return {
    assinaturaDigital: (first & 0x80) !== 0,
    naoRecusa: (first & 0x40) !== 0,
  };
}

const maskCpf = (cpf) =>
  /^\d{11}$/.test(cpf)
    ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`
    : "inválido";
const maskName = (n) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]}.`)
    .join(" ");
const fmtCnpj = (c) =>
  /^\d{14}$/.test(c)
    ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
    : c;

// ---------- execução ----------
console.log("\nVerificação local do certificado. Nada sai deste computador.\n");
const password = await askHidden(
  "Senha do certificado (não aparece na tela): ",
);

const info = pkcs12(["-info", "-noout"], password);
const leaf = pkcs12(["-nokeys", "-clcerts"], password).out;
const chainPem = pkcs12(["-nokeys", "-cacerts"], password).out;
const pemMatch = leaf.match(
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
);
if (!pemMatch) die("O PFX não contém certificado de usuário final.");
const x = new X509Certificate(pemMatch[0]);
const der = x.raw;

// Chave x certificado e compatibilidade com mTLS no Node, sem exportar a chave.
let nodeTls = { ok: true, erro: null };
try {
  createSecureContext({ pfx: readFileSync(pfxPath), passphrase: password });
} catch (e) {
  nodeTls = { ok: false, erro: e.code ?? e.message.split("\n")[0] };
}

const names = otherNames(der);
const tipo = names["2.16.76.1.3.3"]
  ? "e-CNPJ"
  : names["2.16.76.1.3.1"]
    ? "e-CPF"
    : "desconhecido";
const cnpj = (names["2.16.76.1.3.3"] ?? "").replace(/\D/g, "");
const cpfTitular = names["2.16.76.1.3.1"]?.slice(8, 19) ?? null; // e-CPF: data(8)+CPF(11)+...
const cpfResponsavel = names["2.16.76.1.3.4"]?.slice(8, 19) ?? null; // e-CNPJ: responsável
const nomeResponsavel = names["2.16.76.1.3.2"] ?? null;
const ku = keyUsage(der);
const eku = x.keyUsage ?? [];
const text = execFileSync("openssl", ["x509", "-noout", "-text"], {
  input: pemMatch[0],
  encoding: "utf8",
});
const sigAlg =
  text.match(/Signature Algorithm:\s*(\S+)/)?.[1] ?? "desconhecido";
const crlUrls = [...text.matchAll(/URI:(http[^\s]+\.crl)/gi)].map((m) => m[1]);
const now = new Date();
const validTo = new Date(x.validTo);
const validFrom = new Date(x.validFrom);
const days = Math.floor((validTo - now) / 86_400_000);
const keyDetails = x.publicKey.asymmetricKeyDetails ?? {};
// Defesa em profundidade: nenhum texto do relatório leva CPF completo nem o
// sufixo ":<documento>" que a ICP-Brasil põe no CN de pessoas.
const scrub = (s) =>
  String(s)
    .replace(/:(\d{11})\b/g, "")
    .replace(/(?<!\d)(\d{3})(\d{3})(\d{3})(\d{2})(?!\d)/g, "***.$2.$3-**");
const rawIssuer = scrub(x.issuer.match(/CN=([^\n]+)/)?.[1] ?? "");
// Emissor legítimo é uma AC (nome público). Se não parecer AC (ex.:
// autoassinado, em que emissor = titular), só as iniciais.
const issuerCn = /\bAC\b|Autoridade|ICP-Brasil/i.test(rawIssuer)
  ? rawIssuer
  : `${maskName(rawIssuer)} (não parece uma Autoridade Certificadora)`;
const pfxAlgs = [
  ...new Set(
    info.info.match(
      /(?:PBES2|PBKDF2|AES-\d+-CBC|pbeWith[\w-]+|RC2[\w-]*|des-ede3-cbc|3DES[\w-]*)/gi,
    ) ?? [],
  ),
];

let cadeia = {
  verificada: false,
  detalhe:
    "Não verificada (use --cadeia com os certificados públicos do ITI/AC).",
};
const cadeiaArq = opt("--cadeia");
if (cadeiaArq) {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-cert-"));
  try {
    writeFileSync(path.join(dir, "leaf.pem"), pemMatch[0]);
    writeFileSync(path.join(dir, "inter.pem"), chainPem || "");
    const r = spawnSync(
      "openssl",
      [
        "verify",
        "-CAfile",
        path.resolve(cadeiaArq),
        ...(chainPem ? ["-untrusted", path.join(dir, "inter.pem")] : []),
        path.join(dir, "leaf.pem"),
      ],
      { encoding: "utf8" },
    );
    cadeia = {
      verificada: r.status === 0,
      detalhe:
        r.status === 0
          ? "Cadeia confere com os certificados informados."
          : ((r.stderr || r.stdout)
              .split("\n")
              .find((l) => l.includes("error")) ?? "Cadeia não confere."),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let revogacao = {
  verificada: false,
  revogado: null,
  detalhe:
    "Não verificada (rode com --verificar-revogacao; acessa o servidor da AC).",
};
if (flag("--verificar-revogacao") && crlUrls.length) {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-crl-"));
  try {
    const crl = path.join(dir, "lcr.crl");
    const dl = spawnSync(
      "curl",
      ["-sSfL", "--max-time", "30", "-o", crl, crlUrls[0]],
      { encoding: "utf8" },
    );
    if (dl.status !== 0)
      revogacao.detalhe = "Não foi possível baixar a LCR da AC.";
    else {
      const t = spawnSync(
        "openssl",
        ["crl", "-inform", "DER", "-in", crl, "-noout", "-text"],
        { encoding: "utf8" },
      );
      const list =
        t.status === 0
          ? t.stdout
          : spawnSync("openssl", ["crl", "-in", crl, "-noout", "-text"], {
              encoding: "utf8",
            }).stdout;
      const serial = x.serialNumber.toUpperCase();
      const revoked = new RegExp(
        `Serial Number:\\s*0*${serial.replace(/^0+/, "")}\\b`,
        "i",
      ).test(list);
      revogacao = {
        verificada: true,
        revogado: revoked,
        detalhe: revoked
          ? "CERTIFICADO REVOGADO na LCR da AC."
          : "Não consta na LCR baixada.",
      };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const checks = [
  [
    "Tipo",
    tipo === "e-CNPJ",
    tipo === "e-CNPJ"
      ? "e-CNPJ (certificado da empresa)"
      : tipo === "e-CPF"
        ? "e-CPF (certificado PESSOAL)"
        : "não identificado",
  ],
  [
    "CNPJ da WJB",
    tipo === "e-CNPJ" && cnpj === expectedCnpj,
    tipo === "e-CNPJ"
      ? `${fmtCnpj(cnpj)} ${cnpj === expectedCnpj ? "confere" : `NÃO confere com ${fmtCnpj(expectedCnpj)}`}`
      : "não se aplica (não é e-CNPJ)",
  ],
  [
    "Versão X.509",
    x.raw && /Version:\s*3/.test(text),
    text.match(/Version:\s*(\d)/)?.[1]
      ? `v${text.match(/Version:\s*(\d)/)[1]}`
      : "?",
  ],
  ["Emitido por AC ICP-Brasil", /ICP-Brasil/i.test(x.issuer), issuerCn],
  ["Não é certificado de AC", !x.ca, x.ca ? "é certificado de AC" : "ok"],
  [
    "Validade",
    now >= validFrom && now <= validTo,
    `${validFrom.toISOString().slice(0, 10)} a ${validTo.toISOString().slice(0, 10)} (${days} dia(s) restantes)`,
  ],
  [
    "Assinatura Digital + Não Recusa",
    ku.assinaturaDigital && ku.naoRecusa,
    `assinatura digital: ${ku.assinaturaDigital ? "sim" : "não"}; não recusa: ${ku.naoRecusa ? "sim" : "não"}`,
  ],
  [
    "Autenticação de Cliente (mTLS)",
    eku.includes("1.3.6.1.5.5.7.3.2"),
    eku.includes("1.3.6.1.5.5.7.3.2") ? "sim" : "não",
  ],
  [
    "Chave",
    keyDetails.modulusLength >= 2048,
    `${x.publicKey.asymmetricKeyType?.toUpperCase()} ${keyDetails.modulusLength ?? "?"} bits`,
  ],
  [
    "Chave privada corresponde e o Node consegue usar (mTLS)",
    nodeTls.ok,
    nodeTls.ok
      ? "ok"
      : `falhou (${nodeTls.erro})${info.legacy ? "; PFX com criptografia legada" : ""}`,
  ],
  ["Cadeia ICP-Brasil", cadeia.verificada, cadeia.detalhe],
  [
    "Revogação",
    revogacao.verificada && revogacao.revogado === false,
    revogacao.detalhe,
  ],
];

const report = {
  geradoEm: now.toISOString(),
  ferramenta: "scripts/wjb-ai/certificado/verificar-certificado.mjs",
  tipo,
  cnpjDoCertificado: tipo === "e-CNPJ" ? fmtCnpj(cnpj) : null,
  cnpjConfere: tipo === "e-CNPJ" ? cnpj === expectedCnpj : false,
  titularOuResponsavel: {
    cpf: maskCpf(cpfResponsavel ?? cpfTitular ?? ""),
    iniciais: nomeResponsavel
      ? maskName(nomeResponsavel)
      : maskName(x.subject.match(/CN=([^:\n]+)/)?.[1] ?? ""),
  },
  emissor: issuerCn,
  validoDe: validFrom.toISOString().slice(0, 10),
  validoAte: validTo.toISOString().slice(0, 10),
  diasRestantes: days,
  impressaoDigitalSha256: x.fingerprint256.replace(/:/g, "").toLowerCase(),
  algoritmoDeAssinaturaDoCertificado: sigAlg,
  chave: `${x.publicKey.asymmetricKeyType} ${keyDetails.modulusLength ?? "?"}`,
  keyUsage: ku,
  clientAuth: eku.includes("1.3.6.1.5.5.7.3.2"),
  ehAC: x.ca,
  pfx: {
    criptografiaLegada: info.legacy,
    algoritmos: pfxAlgs,
    lidoPeloNode: nodeTls.ok,
  },
  cadeia,
  revogacao,
  verificacoes: checks.map(([item, ok, detalhe]) => ({ item, ok, detalhe })),
};

// Passada final sobre o relatório inteiro (CNPJ de 14 dígitos é preservado).
for (const v of report.verificacoes) v.detalhe = scrub(v.detalhe);
console.log(
  "\nRelatório (sem chave privada, sem senha, dados pessoais mascarados)\n",
);
for (const v of report.verificacoes)
  console.log(`${v.ok ? "OK      " : "ATENÇÃO "} ${v.item}: ${v.detalhe}`);
console.log(`\nImpressão digital SHA-256: ${report.impressaoDigitalSha256}`);
console.log(
  `Hash do relatório: ${createHash("sha256").update(JSON.stringify(report)).digest("hex").slice(0, 16)}`,
);
const saida = opt("--saida");
if (saida) {
  const out = path.resolve(saida);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Relatório gravado em ${out}`);
}
console.log(
  "\nLembrete: este script não envia nada. Não cole o arquivo .pfx nem a senha em chat, e-mail ou WhatsApp.\n",
);
