/**
 * Define a senha de um usuário do Supabase Auth direto pela Admin API.
 *
 * Existe porque o caminho normal ("Send password recovery" no painel do
 * Supabase, ou o formulário de recuperação do site) depende de e-mail - e
 * quando o SMTP está mal configurado, ou o limite de envio do Supabase é
 * atingido, não há como entrar na plataforma de jeito nenhum. Este script é
 * a saída de emergência: usa a SERVICE_ROLE_KEY, que ignora RLS e não passa
 * por e-mail nenhum.
 *
 * NÃO é parte do produto - é ferramenta de operação, rodada à mão, local.
 * A service role key nunca deve ir pro navegador nem pro código do site.
 *
 * Uso:
 *   1. Crie .env.local (já está no .gitignore) com:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
 *   2. node scripts/set-user-password.mjs email@da.conta
 *   3. Digite a nova senha quando for pedido (não aparece na tela nem
 *      no histórico do terminal).
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return {};
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Pergunta a senha sem ecoar o que é digitado. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      // Reescreve a linha sem os caracteres digitados enquanto o readline lê.
      if (["\n", "\r", "\u0004"].includes(char.toString())) return;
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

const env = { ...loadEnvLocal(), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!url || !serviceKey) {
  console.error(
    "Faltam credenciais. Preencha .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
if (!email) {
  console.error("Uso: node scripts/set-user-password.mjs email@da.conta");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function findUser(targetEmail) {
  // A Admin API pagina; a base é pequena, então varrer é suficiente.
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(
      `${url}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(
        `Falha ao listar usuários (HTTP ${response.status}): ${await response.text()}`,
      );
    }
    const body = await response.json();
    const users = body.users ?? [];
    const hit = users.find(
      (user) => user.email?.toLowerCase() === targetEmail.toLowerCase(),
    );
    if (hit) return hit;
    if (users.length < 100) return null;
  }
  return null;
}

const user = await findUser(email);
if (!user) {
  console.error(`Nenhum usuário com o e-mail ${email}.`);
  process.exit(1);
}

console.log(`Usuário encontrado: ${user.email} (id ${user.id})`);
console.log(`E-mail confirmado: ${user.email_confirmed_at ? "sim" : "não"}`);

const password = await askHidden("Nova senha (mínimo 8 caracteres): ");
if (!password || password.length < 8) {
  console.error("Senha muito curta. Nada foi alterado.");
  process.exit(1);
}

const update = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ password, email_confirm: true }),
});

if (!update.ok) {
  console.error(
    `Falha ao definir a senha (HTTP ${update.status}): ${await update.text()}`,
  );
  process.exit(1);
}

console.log("\nSenha definida com sucesso.");
console.log("Entre em https://wjbassessoriacontabil.com.br/login");
