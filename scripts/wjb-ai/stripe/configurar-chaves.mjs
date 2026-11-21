// Fase 9.1: grava as chaves de TESTE da Stripe em .env.stripe.local (fora do
// Git, permissão 600), lendo cada uma da área de transferência do macOS.
// - nenhuma chave é digitada no terminal, exibida, registrada ou enviada;
// - chave live (sk_live_, rk_live_, pk_live_) é recusada;
// - a área de transferência é limpa depois de cada leitura.
// Uso: node scripts/wjb-ai/stripe/configurar-chaves.mjs
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FILE = path.join(ROOT, ".env.stripe.local");
const KEYS = [
  { name: "STRIPE_SECRET_KEY", hint: "chave SECRETA ou RESTRITA de teste (sk_test_... ou rk_test_...)", re: /^(sk|rk)_test_[A-Za-z0-9]{10,}$/ },
  { name: "STRIPE_PUBLISHABLE_KEY", hint: "chave PUBLICÁVEL de teste (pk_test_...)", re: /^pk_test_[A-Za-z0-9]{10,}$/ },
  { name: "STRIPE_WEBHOOK_SECRET", hint: "segredo de assinatura do webhook (whsec_...)", re: /^whsec_[A-Za-z0-9]{10,}$/ },
];

const paste = () => execFileSync("pbpaste", { encoding: "utf8" }).trim();
const clear = () => execFileSync("pbcopy", { input: "" });
const mask = (v) => `${v.slice(0, v.indexOf("_", 3) + 1)}… (${v.length} caracteres)`;

const current = existsSync(FILE) ? Object.fromEntries(readFileSync(FILE, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log("Chaves de TESTE da Stripe -> .env.stripe.local (fora do Git). Nada é exibido.\n");
for (const k of KEYS) {
  const ans = await rl.question(`Copie a ${k.hint} no Dashboard (modo de teste) e tecle Enter (ou "p" para pular): `);
  if (ans.trim().toLowerCase() === "p") continue;
  const v = paste();
  clear();
  if (/^(sk|rk|pk)_live_/.test(v)) {
    console.log("  RECUSADA: é uma chave de PRODUÇÃO (live). Este projeto só aceita teste. Nada foi gravado.");
    continue;
  }
  if (!k.re.test(v)) {
    console.log("  Formato não reconhecido. Nada foi gravado para esta chave.");
    continue;
  }
  current[k.name] = v;
  console.log(`  ok: ${mask(v)}`);
}
rl.close();
const body = ["# Chaves de TESTE da Stripe (Fase 9.1). Fora do Git. Nunca colar no chat.", ...KEYS.filter((k) => current[k.name]).map((k) => `${k.name}=${current[k.name]}`), ""].join("\n");
writeFileSync(FILE, body, { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`\nGravado: ${KEYS.filter((k) => current[k.name]).map((k) => k.name).join(", ") || "nenhuma"}. Arquivo com permissão 600.`);
