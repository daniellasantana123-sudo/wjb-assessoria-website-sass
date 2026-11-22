// Fases 10A/10A.1: MFA (TOTP) nos usuários FICTÍCIOS SUPERADMIN, CONTADOR e
// CONTADORA da HOMOLOGAÇÃO, para testar de verdade o step-up na aplicação e
// o aal2 exigido no banco (0035). Segredos só em .env.homolog.users.local.
// Uso: node scripts/wjb-ai/homologacao-supabase/08-mfa-usuarios.mjs
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const FILE = path.join(ROOT, ".env.homolog.users.local");
const users = parseEnvFile(FILE);
const admin = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const key of ["SUPERADMIN", "CONTADOR", "CONTADORA"]) {
  const c = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: users[`HOMOLOG_USER_${key}`], password: users[`HOMOLOG_PW_${key}`] });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  const secret = await ensureTotp({ admin, client: c, secret: users[`HOMOLOG_TOTP_${key}`], label: key.toLowerCase() });
  saveTotpSecret(FILE, key, secret);
  console.log(`ok    ${key}: MFA ativo (segredo no arquivo local)`);
}
