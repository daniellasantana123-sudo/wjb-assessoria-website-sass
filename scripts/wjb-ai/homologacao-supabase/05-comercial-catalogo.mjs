// Fases 8/9: catálogo de planos e cenário comercial fictício na HOMOLOGAÇÃO.
// Valores APROVADOS pelo responsável pela WJB em 21/11/2026 (documento
// WJB_AI_FASE_8_DECISOES_FASE_9_WHATSAPP_CLICK_TO_CHAT.md). A aprovação é
// registrada pelo super admin fictício com essa referência; cobrança continua
// desligada (assinaturas só simuladas).
// Também prepara o cenário dos E2E: empresa A = cliente de contabilidade
// (combo), empresa B = sem relação; assinaturas abertas são canceladas.
// Uso: node scripts/wjb-ai/homologacao-supabase/05-comercial-catalogo.mjs
import { existsSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
console.log(`Projeto de homologação: ${projectRef(env)}`);
const USERS = path.join(ROOT, ".env.homolog.users.local");
if (!existsSync(USERS)) throw new Error("Rode antes o 02-seed-e-testes-api.mjs.");
const users = parseEnvFile(USERS);
const admin = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sa = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: le } = await sa.auth.signInWithPassword({ email: users.HOMOLOG_USER_SUPERADMIN, password: users.HOMOLOG_PW_SUPERADMIN });
if (le) throw new Error(`login super admin: ${le.message}`);
// 0035: preço e configuração exigem aal2 no banco (como na aplicação, com MFA).
saveTotpSecret(USERS, "SUPERADMIN", await ensureTotp({ admin, client: sa, secret: users.HOMOLOG_TOTP_SUPERADMIN, label: "superadmin" }));

const APPROVAL = "Aprovado pelo responsável pela WJB em 21/11/2026 (decisões da Fase 8)";
const EFFECTIVE_FROM = "2026-11-21";
const PLANS = [
  { sku: "nfse_avulsa", name: "Nota Avulsa", description: "Sem mensalidade: paga só pelas notas autorizadas.", monthly_cents: 0, quota: 0, overage_cents: 490 },
  { sku: "nfse_mei", name: "MEI Digital", description: "Para MEI prestador de serviço. Não inclui DAS, DASN-SIMEI nem contabilidade.", monthly_cents: 2490, quota: 10, overage_cents: 390 },
  { sku: "nfse_profissional", name: "Profissional", description: "Para quem emite com frequência.", monthly_cents: 6990, quota: 50, overage_cents: 250 },
  { sku: "nfse_empresa", name: "Empresa", description: "Franquia maior para ME/EPP prestadoras.", monthly_cents: 14990, quota: 150, overage_cents: 150 },
  { sku: "nfse_volume", name: "Alto Volume", description: "Condições sob proposta.", monthly_cents: null, quota: null, overage_cents: null },
];
for (const p of PLANS) {
  const { data: cur } = await sa.from("commercial_plans").select("*").eq("sku", p.sku).maybeSingle();
  if (!cur) {
    const r = await sa.from("commercial_plans").insert({ ...p, product: "emissao" });
    if (r.error) throw new Error(`plano ${p.sku}: ${r.error.message}`);
  } else if (cur.monthly_cents !== p.monthly_cents || cur.quota !== p.quota || cur.overage_cents !== p.overage_cents || cur.name !== p.name || cur.description !== p.description) {
    const r = await sa.from("commercial_plans").update(p).eq("id", cur.id); // preço mudou: o banco devolve a rascunho
    if (r.error) throw new Error(`plano ${p.sku}: ${r.error.message}`);
  }
  const { data: now } = await sa.from("commercial_plans").select("id, status, version").eq("sku", p.sku).single();
  if (now.status !== "approved") {
    const r = await sa.from("commercial_plans").update({ status: "approved", approval_reference: APPROVAL, effective_from: EFFECTIVE_FROM }).eq("id", now.id);
    if (r.error) throw new Error(`aprovação ${p.sku}: ${r.error.message}`);
  }
  const { data: fin } = await sa.from("commercial_plans").select("status, version, approved_by").eq("sku", p.sku).single();
  console.log(`ok    plano ${p.sku}: ${fin.status} v${fin.version}${fin.approved_by ? " (autor da aprovação gravado)" : ""}`);
}
const { data: disc } = await sa.from("commercial_settings").select("value").eq("key", "combo_discount_bp").maybeSingle();
const d = Number(disc?.value) === 2000 ? { error: null } : await sa.from("commercial_settings").upsert({ key: "combo_discount_bp", value: 2000 });
console.log(`${d.error ? "FALHA" : "ok   "} desconto do combo 20% (aprovado)`);

const { data: tenants } = await admin.from("tenants").select("id, name").in("name", ["Empresa Ficticia A", "Empresa Ficticia B"]);
const A = tenants.find((t) => t.name === "Empresa Ficticia A");
const B = tenants.find((t) => t.name === "Empresa Ficticia B");
await admin.from("commercial_accounts").upsert({ tenant_id: A.id, relationship: "contabilidade" });
await admin.from("commercial_accounts").delete().eq("tenant_id", B.id);
const c = await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "reinício do cenário de homologação" }).in("tenant_id", [A.id, B.id]).neq("status", "cancelada");
console.log(`${c.error ? "FALHA" : "ok   "} cenário: A = contabilidade (combo), B = sem relação, assinaturas abertas canceladas`);
const { count } = await admin.from("commercial_plan_changes").select("id", { count: "exact", head: true });
console.log(`histórico de preço: ${count} registro(s)`);
