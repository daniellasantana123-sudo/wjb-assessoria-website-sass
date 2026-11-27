// Fase 10C: ciclo de vida do certificado (migration 0036) pela API do banco
// da HOMOLOGAÇÃO, com usuários fictícios logados (sem passar pela aplicação).
// Só metadados FICTÍCIOS: impressões digitais aleatórias, sem certificado.
// A lista de bloqueio é permanente por desenho: as impressões digitais
// fictícias desta execução ficam lá (não identificam nada real). Os
// certificados de teste ficam numa empresa descartável, apagada no fim.
// Uso: node scripts/wjb-ai/homologacao-supabase/10-certificados-ciclo-de-vida.mjs
import { randomBytes } from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const FILE = path.join(ROOT, ".env.homolog.users.local");
const users = parseEnvFile(FILE);
const url = env.HOMOLOG_SUPABASE_URL;
const admin = createClient(url, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function as(key) {
  const c = createClient(url, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: users[`HOMOLOG_USER_${key}`], password: users[`HOMOLOG_PW_${key}`] });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  return c;
}
let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "OK   " : "FALHA"} ${label}`);
  if (!cond) fail++;
};
const fp = () => randomBytes(32).toString("hex");
const tenantName = `Empresa Descartavel 10C ${randomBytes(3).toString("hex")}`;
// CNPJ fictício: o e-CNPJ de cliente precisa ser da própria empresa (0037).
const { data: tenant, error: te } = await admin.from("tenants").insert({ name: tenantName, cnpj: "11.222.333/0001-81" }).select("id").single();
if (te) throw new Error(`empresa descartável: ${te.message}`);
const T = tenant.id;
const row = (f, until = 365, spki = fp()) => ({
  role: "cliente",
  tenant_id: T,
  fingerprint_sha256: f,
  spki_sha256: spki,
  holder_document: "11222333000181",
  kind: "A1",
  valid_from: new Date(Date.now() - 86_400_000).toISOString(),
  valid_until: new Date(Date.now() + until * 86_400_000).toISOString(),
  vault_reference: "vault://teste/homolog-10c",
  policy_checked_at: new Date().toISOString(),
});

try {
  const f1 = fp();
  const f2 = fp();
  const { data: c1, error: e1 } = await admin.from("fiscal_certificates").insert(row(f1)).select("id, status").single();
  ok(!e1 && c1.status === "pendente", "C1 servidor registra certificado fictício como pendente");
  const r1 = await admin.rpc("rotate_fiscal_certificate", { p_new: c1.id });
  ok(!r1.error && r1.data === null, "C2 primeira rotação ativa (sem anterior)");
  const { data: c2 } = await admin.from("fiscal_certificates").insert(row(f2, 400)).select("id").single();
  const r2 = await admin.rpc("rotate_fiscal_certificate", { p_new: c2.id });
  ok(r2.data === c1.id, "C3 rotação devolve o substituído");
  const { data: b1 } = await admin.from("fiscal_certificate_blocklist").select("reason").eq("fingerprint_sha256", f1).single();
  ok(b1?.reason === "substituido", "C4 substituído entra na lista permanente");
  const back = await admin.from("fiscal_certificates").update({ status: "ativo" }).eq("id", c1.id);
  ok(!!back.error, "C5 substituído não volta a ser ativo (nem pelo servidor)");
  const del = await admin.from("fiscal_certificate_blocklist").delete().eq("fingerprint_sha256", f1);
  ok(!!del.error, "C6 nem o servidor remove um bloqueio");
  const reins = await admin.from("fiscal_certificates").insert({ ...row(f1), vault_reference: "vault://teste/outra" });
  ok(!!reins.error, "C7 impressão digital bloqueada não é recadastrada");
  const { data: c1row } = await admin.from("fiscal_certificates").select("spki_sha256").eq("id", c1.id).single();
  const sameKey = await admin.from("fiscal_certificates").insert(row(fp(), 365, c1row.spki_sha256));
  ok(!!sameKey.error, "C7b certificado novo com a CHAVE do substituído é recusado (reemissão com o mesmo par)");
  const wrongHolder = await admin.from("fiscal_certificates").insert({ ...row(fp()), holder_document: "99888777000155" });
  ok(!!wrongHolder.error, "C7c e-CNPJ de outro titular não entra como certificado da empresa");

  // Equipe: lê só com MFA; não escreve; não gira.
  const sa1 = await as("SUPERADMIN");
  const { data: seen1 } = await sa1.from("fiscal_certificates").select("id").eq("tenant_id", T);
  ok((seen1 ?? []).length === 0, "C8 super admin só com senha (aal1) não vê o registro");
  const b2 = await sa1.rpc("block_fiscal_certificate", { p_fingerprint: fp(), p_reason: "comprometido" });
  ok(b2.error?.code === "42501", "C9 super admin só com senha não bloqueia");
  const sa2 = await as("SUPERADMIN");
  saveTotpSecret(FILE, "SUPERADMIN", await ensureTotp({ admin, client: sa2, secret: users.HOMOLOG_TOTP_SUPERADMIN, label: "superadmin" }));
  const { data: seen2 } = await sa2.from("fiscal_certificates").select("id").eq("tenant_id", T);
  ok((seen2 ?? []).length === 2, "C10 super admin com MFA vê o registro");
  const doc = await sa2.from("fiscal_certificates").select("holder_document, vault_reference").eq("tenant_id", T);
  ok(!!doc.error, "C10b nem com MFA a equipe lê documento do titular ou referência do cofre pela API");
  const rot = await sa2.rpc("rotate_fiscal_certificate", { p_new: c2.id });
  ok(!!rot.error, "C11 rotação não é chamável pela API do usuário (só servidor)");
  const upd = await sa2.from("fiscal_certificates").update({ status: "bloqueado" }).eq("id", c2.id).select("id");
  ok((upd.data ?? []).length === 0, "C12 equipe não altera o registro direto");
  const fb = fp();
  const b3 = await sa2.rpc("block_fiscal_certificate", { p_fingerprint: fb, p_reason: "comprometido" });
  ok(!b3.error, "C13 super admin com MFA bloqueia uma impressão digital");
  const b4 = await sa2.rpc("block_fiscal_certificate", { p_fingerprint: f2.toUpperCase(), p_reason: "comprometido" });
  const { data: c2s } = await admin.from("fiscal_certificates").select("status").eq("id", c2.id).single();
  ok(!b4.error && c2s.status === "bloqueado", "C14 bloquear o ativo (em maiúsculas) retira o certificado na hora");

  const ct = await as("CONTADOR");
  const b5 = await ct.rpc("block_fiscal_certificate", { p_fingerprint: fp(), p_reason: "comprometido" });
  ok(b5.error?.code === "42501", "C15 contador não bloqueia (só super admin)");

  const cli = await as("CLIENTEA");
  const { data: cs } = await cli.from("fiscal_certificates").select("id");
  const { data: bs } = await cli.from("fiscal_certificate_blocklist").select("fingerprint_sha256");
  ok((cs ?? []).length === 0 && (bs ?? []).length === 0, "C16 cliente não vê certificados nem bloqueios");
  const anon = createClient(url, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const an = await anon.from("fiscal_certificates").select("id");
  ok(!!an.error || (an.data ?? []).length === 0, "C17 anônimo não lê o registro");
} finally {
  // Empresa descartável: a cascata leva os certificados de teste.
  const { error } = await admin.from("tenants").delete().eq("id", T);
  const { data: left } = await admin.from("fiscal_certificates").select("id").eq("tenant_id", T);
  ok(!error && (left ?? []).length === 0, "C18 limpeza: empresa descartável e certificados de teste removidos");
}

console.log(fail ? `\n${fail} falha(s).` : "\nCiclo de vida do certificado: sem falhas.");
process.exit(fail ? 1 : 0);
