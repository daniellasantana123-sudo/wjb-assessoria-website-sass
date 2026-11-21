// Fase 9: testes de segurança da comercialização por REQUISIÇÃO DIRETA à API
// do banco (PostgREST) da HOMOLOGAÇÃO, com login real de usuários fictícios.
// Simula quem ignora a tela e chama o banco: acesso a outra empresa (IDOR),
// troca de preço/status pelo navegador, aprovação por quem não pode.
// Uso: node scripts/wjb-ai/homologacao-supabase/06-seguranca-comercial.mjs
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const users = parseEnvFile(path.join(ROOT, ".env.homolog.users.local"));
const admin = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function as(key) {
  const c = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  if (key) {
    const { error } = await c.auth.signInWithPassword({ email: users[`HOMOLOG_USER_${key}`], password: users[`HOMOLOG_PW_${key}`] });
    if (error) throw new Error(`login ${key}: ${error.message}`);
  }
  return c;
}
let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "OK   " : "FALHA"} ${label}`);
  if (!cond) fail++;
};

const { data: tenants } = await admin.from("tenants").select("id, name").in("name", ["Empresa Ficticia A", "Empresa Ficticia B"]);
const A = tenants.find((t) => t.name === "Empresa Ficticia A").id;
// Cenário: A com assinatura simulada aberta (criada pelo servidor, como a Server Action faz).
const { data: plan } = await admin.from("commercial_plans").select("*").eq("sku", "nfse_mei").single();
await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "teste de segurança" }).eq("tenant_id", A).neq("status", "cancelada");
const today = new Date().toISOString().slice(0, 10);
const start = `${today.slice(0, 7)}-01`;
const [y, m] = today.split("-").map(Number);
const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
const { data: sub, error: se } = await admin
  .from("commercial_subscriptions")
  .insert({ tenant_id: A, plan_id: plan.id, plan_sku: plan.sku, monthly_cents: plan.monthly_cents, quota: plan.quota, overage_cents: plan.overage_cents, discount_bp: 2000, cycle_start: start, cycle_end: end })
  .select("id")
  .single();
if (se) throw new Error(`cenário: ${se.message}`);

const b = await as("CLIENTEB");
const r1 = await b.from("commercial_subscriptions").select("id").eq("tenant_id", A);
ok(!r1.error && r1.data.length === 0, "S1 empresa B não lê a assinatura da A por requisição direta (IDOR)");
const r1b = await b.from("commercial_subscriptions").select("id").eq("id", sub.id);
ok(!r1b.error && r1b.data.length === 0, "S2 empresa B não lê a assinatura da A nem pelo id exato");
const r2 = await b.from("commercial_acceptances").select("id").eq("tenant_id", A);
const r3 = await b.from("commercial_usage_ledger").select("id").eq("tenant_id", A);
ok(r2.data?.length === 0 && r3.data?.length === 0, "S3 empresa B não lê aceites nem consumo da A");
const r4 = await b.rpc("has_entitlement", { p_tenant_id: A, p_feature: "nfse" });
ok(r4.error?.code === "42501", "S4 empresa B não sonda o direito de uso da A (0031)");

const a = await as("CLIENTEA");
const r5 = await a.from("commercial_subscriptions").select("id, monthly_cents").eq("tenant_id", A);
ok(!!r5.data?.some((r) => r.id === sub.id), "S5 empresa A lê a própria assinatura");
await a.from("commercial_subscriptions").update({ monthly_cents: 1, discount_bp: 10000, status: "ativa_simulada" }).eq("id", sub.id);
const { data: after } = await admin.from("commercial_subscriptions").select("monthly_cents, discount_bp").eq("id", sub.id).single();
ok(after.monthly_cents === plan.monthly_cents && after.discount_bp === 2000, "S6 cliente não altera preço nem desconto da própria assinatura pelo navegador");
const r7 = await a.from("commercial_subscriptions").insert({ tenant_id: A, plan_id: plan.id, plan_sku: plan.sku, mode: "real", cycle_start: start, cycle_end: end });
ok(!!r7.error, "S7 cliente não cria assinatura (nem 'real') direto no banco");
const r8 = await a.from("commercial_usage_ledger").insert({ tenant_id: A, subscription_id: sub.id, request_id: "00000000-0000-4000-8000-000000000000", kind: "oficial_autorizada", billable: true, cycle_start: start });
ok(!!r8.error, "S8 cliente não grava consumo faturável");
await a.from("commercial_plans").update({ monthly_cents: 1 }).eq("sku", "nfse_mei");
const r9 = await a.from("commercial_plans").select("id");
const { data: p2 } = await admin.from("commercial_plans").select("monthly_cents, status").eq("sku", "nfse_mei").single();
ok(r9.data?.length === 0 && p2.monthly_cents === plan.monthly_cents && p2.status === "approved", "S9 cliente não lê nem altera o catálogo");
const r10 = await a.from("commercial_settings").upsert({ key: "combo_discount_bp", value: 9000 });
const { data: disc } = await admin.from("commercial_settings").select("value").eq("key", "combo_discount_bp").single();
ok(!!r10.error && Number(disc.value) === 2000, "S10 cliente não altera o desconto do combo");
const r11 = await a.from("commercial_setting_changes").select("id");
ok(r11.data?.length === 0, "S11 cliente não lê o histórico de configuração");

const c = await as("CONTADOR");
const r12 = await c.from("commercial_plans").select("id, status");
ok(r12.data?.length >= 5, "S12 contador lê o catálogo");
await c.from("commercial_plans").update({ monthly_cents: 1 }).eq("sku", "nfse_mei");
const { data: p3 } = await admin.from("commercial_plans").select("monthly_cents, status").eq("sku", "nfse_mei").single();
ok(p3.monthly_cents === plan.monthly_cents && p3.status === "approved", "S13 contador não altera preço aprovado (só super admin)");

const anon = await as(null);
const r14 = await anon.from("commercial_plans").select("id");
const r15 = await anon.from("commercial_subscriptions").select("id");
ok((r14.data ?? []).length === 0 && (r15.data ?? []).length === 0, "S14 visitante anônimo não lê catálogo nem assinaturas pelo banco");

await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "fim do teste de segurança" }).eq("id", sub.id);
console.log(fail ? `\n${fail} falha(s).` : "\nSegurança comercial pela API: sem falhas.");
process.exit(fail ? 1 : 0);
