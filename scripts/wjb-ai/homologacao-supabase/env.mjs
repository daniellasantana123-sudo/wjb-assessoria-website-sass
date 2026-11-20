// Carrega .env.homolog.local SEM imprimir valores e recusa qualquer coisa que
// aponte para a produção. Usado por todos os scripts da homologação Supabase.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const PROD_REF = "hlyukumgyzswfndlzwcf";
const REQUIRED = [
  "HOMOLOG_SUPABASE_URL",
  "HOMOLOG_SUPABASE_ANON_KEY",
  "HOMOLOG_SUPABASE_SERVICE_ROLE_KEY",
  "HOMOLOG_DB_URL",
];

export function parseEnvFile(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function loadHomologEnv({ needDb = true } = {}) {
  const file = path.join(ROOT, ".env.homolog.local");
  if (!existsSync(file)) throw new Error("Falta o arquivo .env.homolog.local (ver docs/wjb-ai/21).");
  const env = parseEnvFile(file);
  for (const key of REQUIRED) {
    if (key === "HOMOLOG_DB_URL" && !needDb) continue;
    if (!env[key]) throw new Error(`Variável ausente em .env.homolog.local: ${key}`);
  }
  for (const [key, value] of Object.entries(env)) {
    if (value.includes(PROD_REF)) {
      throw new Error(`BLOQUEADO: ${key} aponta para o projeto de PRODUÇÃO. Use só o projeto de homologação.`);
    }
  }
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.HOMOLOG_SUPABASE_URL)) {
    throw new Error("HOMOLOG_SUPABASE_URL fora do formato https://<ref>.supabase.co");
  }
  return env;
}

/** Nunca imprimir segredos: só a referência do projeto. */
export function projectRef(env) {
  return env.HOMOLOG_SUPABASE_URL.replace("https://", "").split(".")[0];
}
