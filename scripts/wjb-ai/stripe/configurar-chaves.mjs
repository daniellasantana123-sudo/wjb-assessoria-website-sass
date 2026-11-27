// Fase 9.1: grava as chaves de TESTE da Stripe em .env.stripe.local (fora do
// Git, permissão 600). Fase 10H.1: duas formas de entrada, as duas sem eco:
// (1) Enter vazio = lê da área de transferência do macOS e a limpa depois;
// (2) colar ou digitar direto no terminal com ENTRADA OCULTA (nada aparece).
// O valor nunca vai para argumento de comando, histórico do shell ou log.
// - nenhuma chave é digitada no terminal, exibida, registrada ou enviada;
// - chave live (sk_live_, rk_live_, pk_live_) é recusada;
// - a área de transferência é limpa depois de cada leitura.
// Uso: node scripts/wjb-ai/stripe/configurar-chaves.mjs
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FILE = process.env.STRIPE_ENV_FILE ?? path.join(ROOT, ".env.stripe.local"); // STRIPE_ENV_FILE: só para teste do script
const KEYS = [
  { name: "STRIPE_SECRET_KEY", hint: "chave SECRETA ou RESTRITA de teste (sk_test_... ou rk_test_...)", re: /^(sk|rk)_test_[A-Za-z0-9]{10,}$/ },
  { name: "STRIPE_PUBLISHABLE_KEY", hint: "chave PUBLICÁVEL de teste (pk_test_...)", re: /^pk_test_[A-Za-z0-9]{10,}$/ },
  { name: "STRIPE_WEBHOOK_SECRET", hint: "segredo de assinatura do webhook (whsec_...)", re: /^whsec_[A-Za-z0-9]{10,}$/ },
];

const paste = () => execFileSync("pbpaste", { encoding: "utf8" }).trim();
const clear = () => execFileSync("pbcopy", { input: "" });
const mask = (v) => `${v.slice(0, v.indexOf("_", 3) + 1)}… (${v.length} caracteres)`;

const current = existsSync(FILE) ? Object.fromEntries(readFileSync(FILE, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
/**
 * Entrada OCULTA sem readline: o teclado é lido em modo bruto e nada do que é
 * colado ou digitado vai para a tela (nem asterisco). Backspace apaga; Ctrl+C
 * sai sem gravar nada.
 */
let pending = "";
function askHidden(prompt) {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    const tty = process.stdin.isTTY;
    const finish = (value) => {
      process.stdin.off("data", onData);
      if (tty) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value.trim());
    };
    let buf = "";
    const consume = (text) => {
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "\r" || ch === "\n") {
          pending = text.slice(i + 1).replace(/^\n/, "");
          finish(buf);
          return true;
        }
        if (ch === "\u0003") {
          if (tty) process.stdin.setRawMode(false);
          process.stdout.write("\nCancelado. Nada foi gravado.\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else buf += ch;
      }
      return false;
    };
    const onData = (d) => {
      consume(d.toString("utf8"));
    };
    if (pending && consume(pending)) return;
    pending = "";
    if (tty) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}
const rl = { question: askHidden, close: () => {} };
console.log("Chaves de TESTE da Stripe -> .env.stripe.local (fora do Git). Nada é exibido.\n");
for (const k of KEYS) {
  const ans = await rl.question(`${k.name}: cole a ${k.hint} (entrada oculta) e tecle Enter; ou só Enter para ler da área de transferência; "p" para pular: `);
  if (ans.toLowerCase() === "p") continue;
  let v = ans;
  if (!v) {
    v = paste();
    clear();
  }
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
