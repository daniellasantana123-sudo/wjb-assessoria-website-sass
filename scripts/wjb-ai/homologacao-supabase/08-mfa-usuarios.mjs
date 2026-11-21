// Fase 10A: ativa MFA (TOTP) nos usuários FICTÍCIOS SUPERADMIN e CONTADOR da
// HOMOLOGAÇÃO, para testar de verdade o step-up e o bloqueio de sessão só com
// senha. O segredo vai só para .env.homolog.users.local (fora do Git).
// Uso: node scripts/wjb-ai/homologacao-supabase/08-mfa-usuarios.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { totp } from "./totp.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const FILE = path.join(ROOT, ".env.homolog.users.local");
const users = parseEnvFile(FILE);
let file = readFileSync(FILE, "utf8");

for (const key of ["SUPERADMIN", "CONTADOR"]) {
  const c = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: users[`HOMOLOG_USER_${key}`], password: users[`HOMOLOG_PW_${key}`] });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  const { data: factors } = await c.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
  if (verified && users[`HOMOLOG_TOTP_${key}`]) {
    console.log(`ok    ${key}: MFA já ativo`);
    continue;
  }
  for (const f of factors?.all ?? []) await c.auth.mfa.unenroll({ factorId: f.id });
  const { data: enroll, error: e1 } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: `homolog-${key.toLowerCase()}` });
  if (e1) throw new Error(`enroll ${key}: ${e1.message}`);
  const { error: e2 } = await c.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: totp(enroll.totp.secret) });
  if (e2) throw new Error(`verificação ${key}: ${e2.message}`);
  const line = `HOMOLOG_TOTP_${key}=${enroll.totp.secret}`;
  file = new RegExp(`^HOMOLOG_TOTP_${key}=.*$`, "m").test(file) ? file.replace(new RegExp(`^HOMOLOG_TOTP_${key}=.*$`, "m"), line) : `${file.trimEnd()}\n${line}\n`;
  console.log(`ok    ${key}: MFA ativado (segredo gravado no arquivo local)`);
}
writeFileSync(FILE, file, { mode: 0o600 });
