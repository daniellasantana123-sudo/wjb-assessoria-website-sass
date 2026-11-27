// Fase 10H.1: valida a conexão com a Stripe em MODO DE TESTE, só com leituras
// (GET). Não cria, não altera e não cobra nada. Não exibe chave, id de conta,
// e-mail nem nome: só situação (OK, SEM PERMISSÃO, FALHA) e dados genéricos.
// Lê .env.stripe.local sem mostrar o conteúdo.
// Uso: node scripts/wjb-ai/stripe/validar-conexao.mjs
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FILE = process.env.STRIPE_ENV_FILE ?? path.join(ROOT, ".env.stripe.local");
const API_VERSION = "2024-06-20";

if (!existsSync(FILE)) {
  console.log("Falta .env.stripe.local. Rode antes: node scripts/wjb-ai/stripe/configurar-chaves.mjs");
  process.exit(1);
}
const mode = (statSync(FILE).mode & 0o777).toString(8);
const env = Object.fromEntries(
  readFileSync(FILE, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const secret = env.STRIPE_SECRET_KEY ?? "";
const kind = (v, re) => (!v ? "ausente" : re.test(v) ? "formato de teste OK" : /_live_/.test(v) ? "LIVE (recusada)" : "formato inválido");

console.log("== Arquivo local");
console.log(`  permissão: ${mode} ${mode === "600" ? "(OK)" : "(ATENÇÃO: deveria ser 600)"}`);
console.log(`  STRIPE_SECRET_KEY: ${kind(secret, /^(sk|rk)_test_[A-Za-z0-9]{10,}$/)} (${secret.startsWith("rk_") ? "chave restrita" : secret.startsWith("sk_") ? "chave secreta completa" : "-"})`);
console.log(`  STRIPE_PUBLISHABLE_KEY: ${kind(env.STRIPE_PUBLISHABLE_KEY, /^pk_test_[A-Za-z0-9]{10,}$/)}`);
console.log(`  STRIPE_WEBHOOK_SECRET: ${kind(env.STRIPE_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9]{10,}$/)}`);
if (!/^(sk|rk)_test_/.test(secret)) {
  console.log("\nSem chave secreta de teste: nada foi chamado.");
  process.exit(1);
}

async function get(p) {
  const res = await fetch(`https://api.stripe.com/v1${p}`, {
    headers: { Authorization: `Bearer ${secret}`, "Stripe-Version": API_VERSION },
    signal: AbortSignal.timeout(15000),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

let failures = 0;
console.log("\n== Autenticação e modo");
const probe = await get("/customers?limit=1");
if (probe.status === 401) {
  console.log("  FALHA: a Stripe recusou a chave (401). Confira se copiou a chave inteira pelo botão de copiar.");
  process.exit(1);
}
const livemodeSeen = JSON.stringify(probe.body).includes('"livemode":true');
console.log(`  autenticação: ${probe.status === 200 || probe.status === 403 ? "OK" : `resposta ${probe.status}`}`);
console.log(`  modo: ${livemodeSeen ? "PRODUÇÃO (abortar!)" : "teste (nenhum objeto live)"}`);
if (livemodeSeen) process.exit(1);

console.log("\n== Permissões da chave (só leitura; as escritas são testadas no Sandbox)");
const checks = [
  ["Clientes", "/customers?limit=1"],
  ["Produtos", "/products?limit=1"],
  ["Preços", "/prices?limit=1"],
  ["Sessões de Checkout", "/checkout/sessions?limit=1"],
  ["Assinaturas", "/subscriptions?limit=1"],
  ["Faturas", "/invoices?limit=1"],
  ["Cobranças", "/charges?limit=1"],
  ["Reembolsos", "/refunds?limit=1"],
  ["Eventos", "/events?limit=1"],
  ["Test Clocks", "/test_helpers/test_clocks?limit=1"],
  ["Portal do cliente", "/billing_portal/configurations?limit=1"],
  ["Configuração de métodos", "/payment_method_configurations?limit=10"],
];
const results = {};
for (const [label, p] of checks) {
  const r = await get(p);
  results[label] = r;
  const s = r.status === 200 ? "OK" : r.status === 403 ? "SEM PERMISSÃO" : `FALHA (${r.status})`;
  if (r.status !== 200) failures++;
  console.log(`  ${s.padEnd(14)} ${label}`);
}

console.log("\n== Portal do cliente (Customer Portal)");
const portal = results["Portal do cliente"];
if (portal.status === 200) {
  const n = portal.body.data?.length ?? 0;
  console.log(`  ${n ? "configuração existe" : "nenhuma configuração ainda (a Stripe cria a padrão ao salvar em Settings > Billing > Customer portal)"}`);
}

console.log("\n== Métodos de pagamento (configuração padrão da conta)");
const pmc = results["Configuração de métodos"];
if (pmc.status === 200) {
  const cfg = (pmc.body.data ?? []).find((c) => c.is_default) ?? pmc.body.data?.[0];
  if (!cfg) console.log("  nenhuma configuração encontrada");
  else {
    for (const [key, label] of [
      ["card", "Cartão de crédito"],
      ["pix", "Pix"],
      ["boleto", "Boleto"],
      ["apple_pay", "Apple Pay"],
      ["google_pay", "Google Pay"],
      ["link", "Stripe Link (não usado)"],
    ]) {
      const m = cfg[key];
      if (!m) console.log(`  ${"não aparece".padEnd(22)} ${label}`);
      else {
        const pref = m.display_preference?.value ?? m.display_preference?.preference ?? "?";
        console.log(`  ${(m.available ? `disponível, ${pref === "on" ? "ligado" : "desligado"}` : "indisponível").padEnd(22)} ${label}`);
      }
    }
    console.log("  Pix Automático: a API não mostra separado; conferir com a Stripe se a conta tem acesso");
  }
} else console.log("  sem permissão para ler a configuração de métodos (conferir no Dashboard)");

console.log(`\nResultado: ${failures ? `${failures} item(ns) sem permissão ou com falha (ver acima)` : "tudo OK"}. Nada foi criado nem cobrado.`);
process.exit(failures ? 2 : 0);
