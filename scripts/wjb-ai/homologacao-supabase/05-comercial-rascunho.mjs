// Fase 8: catálogo de planos em RASCUNHO e cenário comercial fictício na
// HOMOLOGAÇÃO. Valores = hipótese do documento da Fase 8, NÃO aprovados.
// Também prepara o cenário dos E2E: empresa A = cliente de contabilidade
// (combo), empresa B = sem relação; assinaturas abertas são canceladas.
// Uso: node scripts/wjb-ai/homologacao-supabase/05-comercial-rascunho.mjs
import { existsSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const USERS = path.join(ROOT, ".env.homolog.users.local");
if (!existsSync(USERS)) throw new Error("Rode antes o 02-seed-e-testes-api.mjs.");
const users = parseEnvFile(USERS);
const admin = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sa = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: le } = await sa.auth.signInWithPassword({ email: users.HOMOLOG_USER_SUPERADMIN, password: users.HOMOLOG_PW_SUPERADMIN });
if (le) throw new Error(`login super admin: ${le.message}`);

const PLANS = [
  { sku: "nfse_avulsa", name: "Nota avulsa", description: "Paga só quando usar.", monthly_cents: 0, quota: null, overage_cents: 490 },
  { sku: "nfse_mei", name: "MEI Digital", description: "Para MEI prestador de serviço. Não inclui DAS, DASN-SIMEI nem contabilidade.", monthly_cents: 2490, quota: 10, overage_cents: 390 },
  { sku: "nfse_profissional", name: "Profissional", description: "Para quem emite com frequência.", monthly_cents: 6990, quota: 50, overage_cents: 250 },
  { sku: "nfse_empresa", name: "Empresa", description: "Franquia maior para ME/EPP prestadoras.", monthly_cents: 14990, quota: 150, overage_cents: 150 },
  { sku: "nfse_volume", name: "Alto Volume", description: "Condições sob proposta.", monthly_cents: null, quota: null, overage_cents: null },
];
for (const p of PLANS) {
  const { data: exists } = await sa.from("commercial_plans").select("id").eq("sku", p.sku).maybeSingle();
  const r = exists ? { error: null } : await sa.from("commercial_plans").insert({ ...p, product: "emissao" });
  console.log(`${r.error ? "FALHA" : "ok   "} plano ${p.sku}${exists ? " (já existia)" : ""}`);
}
const d = await sa.from("commercial_settings").upsert({ key: "combo_discount_bp", value: 2000 });
console.log(`${d.error ? "FALHA" : "ok   "} desconto do combo 20% (rascunho)`);

const { data: tenants } = await admin.from("tenants").select("id, name").in("name", ["Empresa Ficticia A", "Empresa Ficticia B"]);
const A = tenants.find((t) => t.name === "Empresa Ficticia A");
const B = tenants.find((t) => t.name === "Empresa Ficticia B");
await admin.from("commercial_accounts").upsert({ tenant_id: A.id, relationship: "contabilidade" });
await admin.from("commercial_accounts").delete().eq("tenant_id", B.id);
const c = await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "reinício do cenário de homologação" }).in("tenant_id", [A.id, B.id]).neq("status", "cancelada");
console.log(`${c.error ? "FALHA" : "ok   "} cenário: A = contabilidade (combo), B = sem relação, assinaturas abertas canceladas`);
const { count } = await admin.from("commercial_plan_changes").select("id", { count: "exact", head: true });
console.log(`histórico de preço: ${count} registro(s)`);
