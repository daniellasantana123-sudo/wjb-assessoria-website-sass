// Fase 10A.1: credenciais comprometidas (SÓ usuários fictícios) contra a API
// do banco da HOMOLOGAÇÃO. Mesma conta, sessão só com senha (aal1) x com MFA
// (aal2), chamando o PostgREST direto, sem passar pela aplicação.
// Uso: node scripts/wjb-ai/homologacao-supabase/09-seguranca-mfa-banco.mjs
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const FILE = path.join(ROOT, ".env.homolog.users.local");
const users = parseEnvFile(FILE);
const admin = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function as(key) {
  const c = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: users[`HOMOLOG_USER_${key}`], password: users[`HOMOLOG_PW_${key}`] });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  return c;
}
let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "OK   " : "FALHA"} ${label}`);
  if (!cond) fail++;
};
const aal = async (c) => (await c.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel;

const { data: plan } = await admin.from("commercial_plans").select("id, monthly_cents, status, version").eq("sku", "nfse_mei").single();
const { data: tenants } = await admin.from("tenants").select("id, name").in("name", ["Empresa Ficticia A", "Empresa Ficticia B"]);
const A = tenants.find((t) => t.name === "Empresa Ficticia A").id;
const { data: contadorA } = await admin.from("profiles").select("id").eq("email", users.HOMOLOG_USER_CONTADORA).single();

// --- Senha vazada do super admin: sessão aal1 ---
const sa1 = await as("SUPERADMIN");
ok((await aal(sa1)) === "aal1", "M0 a sessão só com senha é aal1");
await sa1.from("commercial_plans").update({ monthly_cents: 1 }).eq("id", plan.id);
const { data: p1 } = await admin.from("commercial_plans").select("monthly_cents, status, version").eq("id", plan.id).single();
ok(p1.monthly_cents === plan.monthly_cents && p1.version === plan.version, "M1 super admin só com senha não altera preço pela API do banco");
const r2 = await sa1.from("commercial_settings").upsert({ key: "combo_discount_bp", value: 5000 });
const { data: d2 } = await admin.from("commercial_settings").select("value").eq("key", "combo_discount_bp").single();
ok(!!r2.error && Number(d2.value) === 2000, "M2 super admin só com senha não altera o desconto do combo");
const r3 = await sa1.rpc("grant_fiscal_profile_approver", { p_profile_id: contadorA.id, p_tenant_id: A, p_reason: "Concessao com senha vazada" });
ok(r3.error?.code === "42501", "M3 super admin só com senha não concede aprovador fiscal");
const r4 = await sa1.rpc("grant_fiscal_profile_approver_impl", { p_profile_id: contadorA.id, p_tenant_id: A, p_reason: "Desvio pela original" });
ok(!!r4.error, "M4 a função original (_impl) não é exposta para contornar a checagem");

// --- Senha vazada do contador: sessão aal1 ---
const c1 = await as("CONTADOR");
const r5 = await c1.rpc("configure_dps_series", { p_tenant_id: A, p_environment: "simulado", p_emitter_document: "12345678000195", p_series: 9 });
ok(r5.error?.code === "42501", "M5 contador só com senha não configura série da DPS");
const r6 = await c1.from("fiscal_authorization_grants").insert({ tenant_id: A, kind: "procuracao", scope: "NFS-e", valid_until: "2027-12-31" });
ok(!!r6.error, "M6 contador só com senha não registra autorização de emissão");
const { data: anyProfile } = await admin.from("fiscal_profiles").select("id").eq("tenant_id", A).limit(1).maybeSingle();
const r7 = await c1.rpc("approve_fiscal_profile", { p_fiscal_profile_id: anyProfile?.id ?? A, p_justification: "Aprovacao com senha vazada" });
ok(r7.error?.code === "42501" && /MFA/.test(r7.error.message), "M7 contador só com senha não aprova perfil fiscal");

// --- Mesma conta COM MFA (aal2): passa da checagem de MFA ---
const sa2 = await as("SUPERADMIN");
saveTotpSecret(FILE, "SUPERADMIN", await ensureTotp({ admin, client: sa2, secret: users.HOMOLOG_TOTP_SUPERADMIN, label: "superadmin" }));
ok((await aal(sa2)) === "aal2", "M8 depois do código do autenticador a sessão é aal2");
const r9 = await sa2.from("commercial_settings").upsert({ key: "combo_discount_bp", value: 2000 }); // mesmo valor aprovado
ok(!r9.error, "M9 super admin com MFA grava a configuração (mesmo valor, nada muda)");

// --- Usuário comum, mesmo com MFA, segue sem permissão ---
const cli = await as("CLIENTEA");
await cli.from("commercial_plans").update({ monthly_cents: 1 }).eq("id", plan.id);
const { data: p10 } = await admin.from("commercial_plans").select("monthly_cents").eq("id", plan.id).single();
ok(p10.monthly_cents === plan.monthly_cents, "M10 cliente não altera preço (RLS de papel continua valendo)");

console.log(fail ? `\n${fail} falha(s).` : "\nMFA no banco: sem falhas.");
process.exit(fail ? 1 : 0);
