// Fase 9.1: segurança dos pagamentos por REQUISIÇÃO DIRETA à API do banco
// (PostgREST) da HOMOLOGAÇÃO, com login real de usuários fictícios.
// Uso: node scripts/wjb-ai/homologacao-supabase/07-seguranca-pagamentos.mjs
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
const { data: plan } = await admin.from("commercial_plans").select("id, version").eq("sku", "nfse_mei").single();
// Cenário criado pelo servidor (service role), como o fluxo real faz.
const tag = `seg${Date.now()}`;
await admin.from("payment_customers").upsert({ tenant_id: A, mode: "mock", provider_customer_id: `cus_${tag}` }, { onConflict: "tenant_id", ignoreDuplicates: true });
const { data: sub } = await admin.from("commercial_subscriptions").select("id, status").eq("tenant_id", A).neq("status", "cancelada").maybeSingle();
let subId = sub?.id;
if (!subId) {
  const r = await admin.from("commercial_subscriptions").insert({ tenant_id: A, plan_id: plan.id, plan_sku: "nfse_mei", mode: "simulado", status: "inadimplente", monthly_cents: 2490, quota: 10, overage_cents: 390, cycle_start: "2026-11-01", cycle_end: "2026-12-01" }).select("id").single();
  subId = r.data.id;
}
await admin.from("payment_invoices").insert({ provider_invoice_id: `in_${tag}`, tenant_id: A, subscription_id: subId, mode: "mock", status: "paga", amount_due_cents: 1992, amount_paid_cents: 1992 });
await admin.from("payment_checkouts").insert({ tenant_id: A, subscription_id: subId, plan_id: plan.id, plan_version: plan.version, kind: "subscription", mode: "mock", provider_session_id: `cs_${tag}`, amount_cents: 1992, discount_bp: 2000, status: "concluido" });

const b = await as("CLIENTEB");
const r1 = await b.from("payment_invoices").select("provider_invoice_id").eq("tenant_id", A);
const r2 = await b.from("payment_checkouts").select("id").eq("provider_session_id", `cs_${tag}`);
ok(r1.data?.length === 0 && r2.data?.length === 0, "P1 empresa B não lê fatura nem checkout da A, nem pelo id exato (IDOR)");
const r3 = await b.from("payment_customers").select("provider_customer_id");
ok(r3.data?.length === 0, "P2 cliente não lê ids de cliente no provedor (nem o próprio)");
const a = await as("CLIENTEA");
const r4 = await a.from("payment_invoices").select("provider_invoice_id").eq("provider_invoice_id", `in_${tag}`);
ok(r4.data?.length === 1, "P3 empresa A lê a própria fatura");
const r5 = await a.from("payment_events").select("provider_event_id");
const r6 = await a.from("payment_prices").select("id");
const r7 = await a.from("payment_mock_objects").select("id");
ok(r5.data?.length === 0 && r6.data?.length === 0 && (r7.data ?? []).length === 0, "P4 cliente não lê log de eventos, preços no provedor nem objetos simulados");
const r8 = await a.from("payment_events").insert({ provider_event_id: `evt_forjado_${tag}`, mode: "mock", type: "invoice.paid" });
ok(!!r8.error, "P5 cliente não forja evento de pagamento");
const r9 = await a.from("payment_invoices").update({ status: "paga", amount_paid_cents: 999999 }).eq("provider_invoice_id", `in_${tag}`).select();
const { data: inv } = await admin.from("payment_invoices").select("amount_paid_cents").eq("provider_invoice_id", `in_${tag}`).single();
ok((r9.data ?? []).length === 0 && inv.amount_paid_cents === 1992, "P6 cliente não altera fatura");
await a.from("commercial_subscriptions").update({ status: "ativa_teste" }).eq("id", subId);
const { data: s2 } = await admin.from("commercial_subscriptions").select("status").eq("id", subId).single();
ok(s2.status === (sub?.status ?? "inadimplente"), "P7 cliente não muda o status de pagamento da assinatura");
const r10 = await a.from("payment_checkouts").insert({ tenant_id: A, subscription_id: subId, plan_id: plan.id, plan_version: plan.version, kind: "subscription", mode: "mock", amount_cents: 1, discount_bp: 5000 });
ok(!!r10.error, "P8 cliente não cria checkout com preço próprio");
const r11 = await admin.from("commercial_subscriptions").insert({ tenant_id: A, plan_id: plan.id, plan_sku: "nfse_mei", mode: "stripe_live", cycle_start: "2026-11-01", cycle_end: "2026-12-01" });
ok(!!r11.error, "P9 nem o servidor grava assinatura em modo live");
const r12 = await admin.from("payment_events").insert({ provider_event_id: `evt_live_${tag}`, mode: "test", type: "invoice.paid", livemode: true });
ok(!!r12.error, "P10 nem o servidor grava evento live");
const c = await as("CONTADOR");
const r13 = await c.from("payment_events").select("provider_event_id").limit(1);
ok(!r13.error, "P11 equipe lê o log de eventos");
const anon = await as(null);
const r14 = await anon.from("payment_invoices").select("provider_invoice_id");
ok((r14.data ?? []).length === 0, "P12 visitante anônimo não lê faturas");

// Limpeza do cenário de teste.
await admin.from("payment_checkouts").delete().eq("provider_session_id", `cs_${tag}`);
await admin.from("payment_invoices").delete().eq("provider_invoice_id", `in_${tag}`);
if (!sub) await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "fim do teste" }).eq("id", subId);
console.log(fail ? `\n${fail} falha(s).` : "\nSegurança dos pagamentos pela API: sem falhas.");
process.exit(fail ? 1 : 0);
