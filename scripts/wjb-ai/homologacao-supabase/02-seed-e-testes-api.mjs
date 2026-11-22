// Homologação REAL: usuários fictícios no Supabase Auth de homologação e
// testes de RLS/permissões pela API (PostgREST), com JWT de verdade.
// Senhas de teste são geradas aqui e gravadas só em .env.homolog.users.local
// (ignorado pelo Git); nunca aparecem na saída.
// Uso: node scripts/wjb-ai/homologacao-supabase/02-seed-e-testes-api.mjs
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
const URL_ = env.HOMOLOG_SUPABASE_URL;
const admin = createClient(URL_, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const USERS_FILE = path.join(ROOT, ".env.homolog.users.local");
console.log(`Projeto de homologação: ${projectRef(env)}\n`);

const PEOPLE = {
  clienteA: { email: "cliente.a@exemplo.test", name: "Cliente A (ficticio)" },
  clienteB: { email: "cliente.b@exemplo.test", name: "Cliente B (ficticio)" },
  clienteAB: { email: "cliente.ab@exemplo.test", name: "Cliente das duas empresas" },
  contador: { email: "contador.autorizado@exemplo.test", name: "Contador Autorizado", staff: "contador" },
  contadorSem: { email: "contador.sem@exemplo.test", name: "Contador Sem Permissao", staff: "contador" },
  contadorA: { email: "contador.so.a@exemplo.test", name: "Contador So A", staff: "contador" },
  atendimento: { email: "atendimento@exemplo.test", name: "Atendimento", staff: "atendimento" },
  superadmin: { email: "superadmin@exemplo.test", name: "Super Admin", staff: "super_admin" },
};
const TENANTS = { A: "Empresa Ficticia A", B: "Empresa Ficticia B" };

// ---------- seed idempotente ----------
const saved = existsSync(USERS_FILE) ? parseEnvFile(USERS_FILE) : {};
const ids = {};
const passwords = {};
const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
for (const [key, p] of Object.entries(PEOPLE)) {
  const envKey = `HOMOLOG_PW_${key.toUpperCase()}`;
  passwords[key] = saved[envKey] ?? randomBytes(18).toString("base64url");
  const existing = list.users.find((u) => u.email === p.email);
  if (existing) {
    ids[key] = existing.id;
    await admin.auth.admin.updateUserById(existing.id, { password: passwords[key] });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email, password: passwords[key], email_confirm: true, user_metadata: { full_name: p.name },
    });
    if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
    ids[key] = data.user.id;
  }
  if (p.staff) {
    const { error } = await admin.from("profiles").update({ is_wjb_staff: true, staff_role: p.staff, status: "active" }).eq("id", ids[key]);
    if (error) throw new Error(`perfil ${key}: ${error.message}`);
  }
}
// Preserva os segredos TOTP (Fase 10A.1): reescrever o arquivo sem eles trancava os usuários com MFA.
const keptTotp = Object.entries(saved).filter(([k]) => k.startsWith("HOMOLOG_TOTP_")).map(([k, v]) => `${k}=${v}`);
writeFileSync(USERS_FILE, [...Object.entries(PEOPLE).map(([k, p]) => `HOMOLOG_USER_${k.toUpperCase()}=${p.email}\nHOMOLOG_PW_${k.toUpperCase()}=${passwords[k]}`), ...keptTotp].join("\n") + "\n", { mode: 0o600 });

const tenantIds = {};
for (const [k, name] of Object.entries(TENANTS)) {
  const { data: found } = await admin.from("tenants").select("id").eq("name", name).maybeSingle();
  tenantIds[k] = found?.id ?? (await admin.from("tenants").insert({ name }).select("id").single()).data.id;
}
for (const [person, tenant] of [["clienteA", "A"], ["clienteB", "B"], ["clienteAB", "A"], ["clienteAB", "B"]]) {
  await admin.from("tenant_members").upsert({ tenant_id: tenantIds[tenant], profile_id: ids[person], role: "owner" }, { onConflict: "tenant_id,profile_id" });
}
console.log("Seed fictício pronto: 8 usuários, 2 empresas.\n");

// ---------- helpers ----------
async function as(key) {
  const c = createClient(URL_, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: PEOPLE[key].email, password: passwords[key] });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  return c;
}
const anon = createClient(URL_, env.HOMOLOG_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "FALHA"} ${label}${detail ? ` (${detail})` : ""}`);
};
const run = Date.now().toString(36);
const draft = { serviceDescription: "Servico ficticio", amountCents: 8000, competence: "2026-11", taker: { document: "52998224725", documentKind: "CPF", name: "Tomador Ficticio" } };
const newReq = (tenant, creator, key, extra = {}) => ({ tenant_id: tenantIds[tenant], created_by: ids[creator], idempotency_key: key, draft_snapshot: draft, draft_hash: key, ...extra });

const A = await as("clienteA"), B = await as("clienteB");
const atend = await as("atendimento"), cont = await as("contador"), contSem = await as("contadorSem"), contA = await as("contadorA"), sa = await as("superadmin");
// 0035: operações sensíveis exigem aal2 no banco; quem as faz nos testes completa o MFA (contadorSem e atendimento ficam sem).
for (const [key, client] of [["SUPERADMIN", sa], ["CONTADOR", cont], ["CONTADORA", contA]]) {
  const secret = await ensureTotp({ admin, client, secret: saved[`HOMOLOG_TOTP_${key}`], label: key.toLowerCase() });
  saveTotpSecret(USERS_FILE, key, secret);
}

// ---------- regressão: tabelas que já existiam ----------
for (const t of ["A", "B"]) {
  const { data: has } = await admin.from("obligations").select("id").eq("tenant_id", tenantIds[t]).limit(1);
  if (!has?.length) await admin.from("obligations").insert({ tenant_id: tenantIds[t], title: `DAS ficticio ${t}`, due_date: "2026-12-20" });
}
const tA = await A.from("tenants").select("id");
check(tA.data?.length === 1 && tA.data[0].id === tenantIds.A, "R01 cliente A só enxerga a própria empresa (tenants)");
const oA = await A.from("obligations").select("tenant_id");
check(oA.data?.length > 0 && oA.data.every((o) => o.tenant_id === tenantIds.A), "R02 obrigações isoladas por empresa");
const pB = await A.from("profiles").select("id").eq("id", ids.clienteB);
check((pB.data ?? []).length === 0, "R03 cliente A não lê o perfil do cliente B");
const selfPromote = await A.from("profiles").update({ is_wjb_staff: true, staff_role: "super_admin" }).eq("id", ids.clienteA);
check(!!selfPromote.error, "R04 cliente não se autopromove a super_admin (0022)", selfPromote.error?.code);
// Sem .select(): o visitante grava, mas não pode ler de volta (igual ao site).
const lead = await anon.from("leads").insert({ name: "Lead Ficticio", email: `lead-${Date.now()}@exemplo.test`, form_context: "homologacao" });
check(!lead.error, "R05 visitante consegue gravar um lead (formulário do site)", lead.error?.code);
const leadsRead = await anon.from("leads").select("id");
check((leadsRead.data ?? []).length === 0, "R06 visitante não lê leads");

// ---------- pedidos: criação, leitura, alteração ----------
const ins = await A.from("fiscal_requests").insert(newReq("A", "clienteA", `a-${run}`)).select("id").single();
check(!ins.error, "T01 cliente A cria pedido na própria empresa (Auth + PostgREST)", ins.error?.message);
await B.from("fiscal_requests").insert(newReq("B", "clienteB", `b-${run}`));
const readA = await A.from("fiscal_requests").select("tenant_id");
check(readA.data?.every((r) => r.tenant_id === tenantIds.A) && readA.data.length > 0, "T02 cliente A só lê pedidos da empresa A");
const crossB = await A.from("fiscal_requests").select("id").eq("tenant_id", tenantIds.B);
check(crossB.data?.length === 0, "T03 consulta direta da empresa B por A volta vazia");
const insB = await A.from("fiscal_requests").insert(newReq("B", "clienteA", `x-${run}`));
check(!!insB.error, "T04 cliente A não cria pedido na empresa B", insB.error?.code);
const forged = await A.from("fiscal_requests").insert(newReq("A", "clienteA", `f-${run}`, { status: "AUTORIZADA" }));
check(!!forged.error, "T05 cliente não cria pedido já AUTORIZADA", forged.error?.code);
const imperson = await A.from("fiscal_requests").insert(newReq("A", "clienteB", `i-${run}`));
check(!!imperson.error, "T06 cliente não cria pedido em nome de outra pessoa", imperson.error?.code);
const upd = await A.from("fiscal_requests").update({ status: "CONFIRMADA" }).eq("id", ins.data?.id).select("id");
check((upd.data ?? []).length === 0, "T07 cliente não altera o próprio pedido");
const ev = await A.from("fiscal_request_events").insert({ request_id: ins.data?.id, tenant_id: tenantIds.A, to_status: "AUTORIZADA" });
check(!!ev.error, "T08 cliente não grava evento", ev.error?.code);
const dup = await A.from("fiscal_requests").insert(newReq("A", "clienteA", `a-${run}`));
check(dup.error?.code === "23505", "T09 mesma chave na mesma empresa é recusada (idempotência)", dup.error?.code);
const conc = await Promise.all(Array.from({ length: 5 }, () => A.from("fiscal_requests").insert(newReq("A", "clienteA", `c-${run}`))));
check(conc.filter((r) => !r.error).length === 1, "T10 5 envios simultâneos iguais geram 1 pedido", `${conc.filter((r) => !r.error).length} gravado(s)`);
const anonRead = await anon.from("fiscal_requests").select("id");
check((anonRead.data ?? []).length === 0, "T11 visitante sem login não lê pedidos");

// ---------- equipe ----------
const toReview = await atend.from("fiscal_requests").update({ status: "REVISAO_HUMANA" }).eq("id", ins.data?.id).select("id");
check(toReview.data?.length === 1, "T12 equipe move pedido para REVISAO_HUMANA");
const forge = await atend.from("fiscal_requests").update({ status: "AUTORIZADA" }).eq("id", ins.data?.id).select("id");
check(!!forge.error || (forge.data ?? []).length === 0, "T13 equipe não marca AUTORIZADA", forge.error?.code);
const att = await atend.from("fiscal_issuance_attempts").insert({ request_id: ins.data?.id, tenant_id: tenantIds.A, environment: "mock", idempotency_key: `a-${run}`, outcome: "AUTORIZADA", simulated: true });
check(!!att.error, "T14 equipe não grava tentativa de envio", att.error?.code);

// ---------- fiscal_profile.approve ----------
const prof = await admin.from("fiscal_profiles").insert({ tenant_id: tenantIds.A, version: Date.now() % 100000, created_by: ids.contador }).select("id").single();
const profB = await admin.from("fiscal_profiles").insert({ tenant_id: tenantIds.B, version: Date.now() % 100000, created_by: ids.contador }).select("id").single();
await admin.from("fiscal_profile_approver_grants").update({ revoked_at: new Date().toISOString(), revoke_reason: "reinicio do teste" }).is("revoked_at", null);
const noGrant = await contSem.rpc("approve_fiscal_profile", { p_fiscal_profile_id: prof.data.id, p_justification: "Tentativa sem concessao" });
check(!!noGrant.error, "T15 contador sem concessão não aprova", noGrant.error?.code);
const direct = await contSem.from("fiscal_profiles").update({ status: "approved" }).eq("id", prof.data.id).select("id");
check(!!direct.error || (direct.data ?? []).length === 0, "T16 aprovar editando a tabela é bloqueado");
const self = await cont.rpc("grant_fiscal_profile_approver", { p_profile_id: ids.contador, p_tenant_id: null, p_reason: "Autoconcessao indevida" });
check(!!self.error, "T17 contador não concede permissão a si mesmo", self.error?.code);
const toAtend = await sa.rpc("grant_fiscal_profile_approver", { p_profile_id: ids.atendimento, p_tenant_id: null, p_reason: "Atendimento nao pode" });
check(!!toAtend.error, "T18 permissão não vai para Atendimento", toAtend.error?.code);
const g1 = await sa.rpc("grant_fiscal_profile_approver", { p_profile_id: ids.contador, p_tenant_id: null, p_reason: "Contador responsavel pela carteira" });
const g2 = await sa.rpc("grant_fiscal_profile_approver", { p_profile_id: ids.contadorA, p_tenant_id: tenantIds.A, p_reason: "Contador somente da empresa A" });
check(!g1.error && !g2.error, "T19 super_admin concede (geral e só empresa A)", g1.error?.message ?? g2.error?.message);
const saApprove = await sa.rpc("approve_fiscal_profile", { p_fiscal_profile_id: prof.data.id, p_justification: "Super admin tentando aprovar" });
check(!!saApprove.error, "T20 super_admin concede, mas não aprova", saApprove.error?.code);
const scope = await contA.rpc("approve_fiscal_profile", { p_fiscal_profile_id: profB.data.id, p_justification: "Fora do escopo da concessao" });
check(!!scope.error, "T21 concessão da empresa A não aprova a empresa B", scope.error?.code);
const short = await cont.rpc("approve_fiscal_profile", { p_fiscal_profile_id: prof.data.id, p_justification: "curta" });
check(!!short.error, "T22 aprovação exige justificativa", short.error?.code);
const ok = await cont.rpc("approve_fiscal_profile", { p_fiscal_profile_id: prof.data.id, p_justification: "Conferido com documentos ficticios" });
check(!ok.error, "T23 contador autorizado aprova com justificativa", ok.error?.message);
const hist = await admin.from("fiscal_profile_approvals").select("approved_by, justification").eq("fiscal_profile_id", prof.data.id);
check(hist.data?.[0]?.approved_by === ids.contador, "T24 histórico registra quem aprovou e a justificativa");
const aud = await admin.from("audit_log").select("id").eq("action", "fiscal.profile_approved").eq("entity_id", prof.data.id);
check(aud.data?.length === 1, "T25 aprovação gravada no audit_log");
const immut = await cont.from("fiscal_profiles").update({ max_amount_cents_without_review: 1 }).eq("id", prof.data.id).select("id");
check((immut.data ?? []).length === 0, "T26 perfil aprovado é imutável");
const clientSees = await A.from("fiscal_profile_approver_grants").select("id");
check((clientSees.data ?? []).length === 0, "T27 cliente não enxerga concessões");
await sa.rpc("revoke_fiscal_profile_approver", { p_grant_id: g1.data, p_reason: "Revogacao de teste" });
const after = await cont.rpc("can_approve_fiscal_profile", { check_tenant_id: tenantIds.A });
check(after.data === false, "T28 revogação retira a permissão na hora");
const grantByContador = await contA.rpc("revoke_fiscal_profile_approver", { p_grant_id: g2.data, p_reason: "Contador tentando revogar" });
check(!!grantByContador.error, "T29 só super_admin revoga", grantByContador.error?.code);

// ---------- versões (0026) ----------
const vIns = await A.from("fiscal_request_versions").insert({ request_id: ins.data?.id, tenant_id: tenantIds.A, version: 99, draft_snapshot: draft, draft_hash: "x" });
check(!!vIns.error, "T30 cliente não grava versão de pedido (só o servidor)", vIns.error?.code);
await admin.from("fiscal_request_versions").insert({ request_id: ins.data?.id, tenant_id: tenantIds.A, version: Date.now() % 100000, draft_snapshot: draft, draft_hash: "h" });
const vA = await A.from("fiscal_request_versions").select("id").eq("request_id", ins.data?.id);
const vB = await B.from("fiscal_request_versions").select("id").eq("request_id", ins.data?.id);
check((vA.data ?? []).length > 0 && (vB.data ?? []).length === 0, "T31 versões visíveis só para a empresa dona");

// ---------- série, numeração e autorização de emissão (0027) ----------
const serie = 1 + (Date.now() % 49000);
const atSerie = await atend.rpc("configure_dps_series", { p_tenant_id: tenantIds.A, p_environment: "simulado", p_emitter_document: "00000000000191", p_series: serie });
check(!!atSerie.error, "T32 atendimento não configura série da DPS", atSerie.error?.code);
const prodSerie = await sa.rpc("configure_dps_series", { p_tenant_id: tenantIds.A, p_environment: "producao", p_emitter_document: "00000000000191", p_series: serie });
check(!!prodSerie.error, "T33 série de produção bloqueada até para super_admin", prodSerie.error?.code);
const okSerie = await contA.rpc("configure_dps_series", { p_tenant_id: tenantIds.A, p_environment: "simulado", p_emitter_document: "00000000000191", p_series: serie });
check(!okSerie.error, "T34 contador com fiscal_profile.approve configura a série", okSerie.error?.message);
const reqIds = [];
for (let i = 0; i < 12; i++) {
  const r = await admin.from("fiscal_requests").insert(newReq("A", "clienteA", `n-${run}-${i}`, { status: "AUTORIZADA_PARA_ENVIO" })).select("id").single();
  reqIds.push(r.data?.id);
}
const userAlloc = await cont.rpc("allocate_dps_number", { p_request_id: reqIds[0], p_environment: "simulado" });
check(!!userAlloc.error, "T35 usuário logado não executa a numeração (só o servidor)", userAlloc.error?.code);
const calls = [...reqIds.map((id) => admin.rpc("allocate_dps_number", { p_request_id: id, p_environment: "simulado" })),
  ...Array.from({ length: 6 }, () => admin.rpc("allocate_dps_number", { p_request_id: reqIds[0], p_environment: "simulado" }))];
const results = await Promise.all(calls);
const nums = results.slice(0, 12).map((r) => Number(r.data?.[0]?.number));
const repeats = results.slice(12).map((r) => Number(r.data?.[0]?.number));
check(results.every((r) => !r.error) && new Set(nums).size === 12 && Math.min(...nums) === 1 && Math.max(...nums) === 12,
  "T36 18 chamadas simultâneas pela API: 12 pedidos com números 1 a 12, sem repetição", results.find((r) => r.error)?.error?.message ?? nums.join(","));
check(repeats.every((n) => n === nums[0]), "T37 repetições do mesmo pedido devolvem o MESMO número", repeats.join(","));
// Limpeza: os pedidos de numeração não podem ficar na fila simulada (eles
// ocupariam o lote do processamento usado pelos E2E). Números primeiro (FK).
const numberedKeys = (await admin.from("fiscal_requests").select("id").like("idempotency_key", "n-%")).data?.map((r) => r.id) ?? [];
if (numberedKeys.length) {
  await admin.from("fiscal_dps_numbers").delete().in("request_id", numberedKeys);
  await admin.from("fiscal_request_events").delete().in("request_id", numberedKeys);
  await admin.from("fiscal_requests").delete().in("id", numberedKeys);
}
const left = await admin.from("fiscal_requests").select("id").like("idempotency_key", "n-%");
check((left.data ?? []).length === 0, "T37b pedidos de teste da numeração removidos da fila");
const seenB = await B.from("fiscal_dps_numbers").select("request_id");
check((seenB.data ?? []).length === 0, "T38 empresa B não vê a numeração da empresa A");
const grant = await cont.from("fiscal_authorization_grants").insert({ tenant_id: tenantIds.A, kind: "procuracao", emission_model: "wjb_procuracao", scope: "Emissão de NFS-e (fictício)", valid_until: "2027-11-20", evidence_reference: "Pasta fictícia", certificate_holder_document: "00000000000272", registered_by: ids.contador }).select("id").single();
check(!grant.error, "T39 equipe registra procuração (modelo A)", grant.error?.message);
const pem = await cont.from("fiscal_authorization_grants").insert({ tenant_id: tenantIds.A, kind: "procuracao", scope: "x", valid_until: "2027-01-01", certificate_vault_reference: "-----BEGIN PRIVATE KEY-----" });
check(!!pem.error, "T40 banco recusa chave colada no lugar da referência ao cofre", pem.error?.code);
const del = await cont.from("fiscal_authorization_grants").delete().eq("id", grant.data?.id).select("id");
check(!!del.error || (del.data ?? []).length === 0, "T41 autorização não pode ser apagada", del.error?.code);
const rev = await cont.from("fiscal_authorization_grants").update({ revoked_at: new Date().toISOString(), revoked_by: ids.contador, revoke_reason: "Cliente revogou (fictício)" }).eq("id", grant.data?.id).select("status").single();
check(rev.data?.status === "revoked", "T42 revogação com motivo muda o status", rev.error?.message);
const back = await cont.from("fiscal_authorization_grants").update({ revoked_at: null, status: "active" }).eq("id", grant.data?.id).select("id");
check(!!back.error, "T43 autorização revogada não volta a valer", back.error?.code);

// ---------- trilha de uso do certificado (0028) ----------
const useIns = await admin.from("fiscal_certificate_usage").insert({ tenant_id: tenantIds.A, purpose: "assinatura", environment: "simulado", outcome: "ok", certificate_fingerprint: "c".repeat(64) }).select("id").single();
check(!useIns.error, "T44 servidor registra uso do certificado", useIns.error?.message);
const staffIns = await cont.from("fiscal_certificate_usage").insert({ tenant_id: tenantIds.A, purpose: "assinatura", environment: "simulado", outcome: "ok" });
check(!!staffIns.error, "T45 equipe não grava na trilha (só o servidor)", staffIns.error?.code);
const useUpd = await admin.from("fiscal_certificate_usage").update({ outcome: "negado" }).eq("id", useIns.data?.id);
check(!!useUpd.error, "T46 nem o servidor altera a trilha", useUpd.error?.code);
const useDel = await admin.from("fiscal_certificate_usage").delete().eq("id", useIns.data?.id);
check(!!useDel.error, "T47 nem o servidor apaga a trilha", useDel.error?.code);
const staffSees = await cont.from("fiscal_certificate_usage").select("id").eq("id", useIns.data?.id);
const clientSees2 = await A.from("fiscal_certificate_usage").select("id");
check((staffSees.data ?? []).length === 1 && (clientSees2.data ?? []).length === 0, "T48 só a equipe lê a trilha");
const secretReason = await admin.from("fiscal_certificate_usage").insert({ tenant_id: tenantIds.A, purpose: "mtls", environment: "simulado", outcome: "erro", reason: "password=123" });
check(!!secretReason.error, "T49 motivo da trilha não aceita senha", secretReason.error?.code);

console.log(`\n${failures === 0 ? "Homologação pela API concluída sem falhas." : `${failures} FALHA(S).`}`);
console.log("Credenciais de teste em .env.homolog.users.local (fora do Git).");
process.exit(failures ? 1 : 0);
