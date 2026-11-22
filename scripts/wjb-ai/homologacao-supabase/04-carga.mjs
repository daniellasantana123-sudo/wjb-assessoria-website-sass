// Teste de carga da Fase 7 no projeto de HOMOLOGAÇÃO (nunca produção).
// Para 10, 30 e 100 pedidos simultâneos: o cliente A (login real, RLS) cria
// pedidos com chave de idempotência, mandando cada um DUAS vezes ao mesmo
// tempo; depois o servidor numera as DPS em paralelo. Mede latência e erros
// e confere: nenhuma duplicidade, numeração sem repetição. Limpa tudo no fim.
// Uso: node scripts/wjb-ai/homologacao-supabase/04-carga.mjs [10,30,100]
import { existsSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadHomologEnv, parseEnvFile, projectRef, ROOT } from "./env.mjs";
import { ensureTotp, saveTotpSecret } from "./mfa.mjs";

const env = loadHomologEnv({ needDb: false });
const ref = projectRef(env);
console.log(`Projeto de homologação: ${ref}`);
const USERS = path.join(ROOT, ".env.homolog.users.local");
if (!existsSync(USERS))
  throw new Error(
    "Rode antes o 02-seed-e-testes-api.mjs (usuários fictícios).",
  );
const users = parseEnvFile(USERS);
const admin = createClient(
  env.HOMOLOG_SUPABASE_URL,
  env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function login(key) {
  const c = createClient(
    env.HOMOLOG_SUPABASE_URL,
    env.HOMOLOG_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: users[`HOMOLOG_USER_${key}`],
    password: users[`HOMOLOG_PW_${key}`],
  });
  if (error) throw new Error(`login ${key}: ${error.message}`);
  return c;
}

const A = await login("CLIENTEA");
const contA = await login("CONTADORA");
// 0035: configurar a série da DPS exige aal2 no banco.
{
  const adminMfa = createClient(env.HOMOLOG_SUPABASE_URL, env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  saveTotpSecret(path.join(ROOT, ".env.homolog.users.local"), "CONTADORA", await ensureTotp({ admin: adminMfa, client: contA, secret: users.HOMOLOG_TOTP_CONTADORA, label: "contadora" }));
}
const { data: me } = await A.auth.getUser();
const { data: tenant } = await A.from("tenants").select("id").limit(1).single();
const tenantId = tenant.id;

// Série de simulação ativa para a empresa A (série nova a cada execução).
const series = 1 + (Date.now() % 49000);
const cfg = await contA.rpc("configure_dps_series", {
  p_tenant_id: tenantId,
  p_environment: "simulado",
  p_emitter_document: "00000000000191",
  p_series: series,
});
if (cfg.error) throw new Error(`série: ${cfg.error.message}`);

const pct = (arr, p) =>
  arr.slice().sort((a, b) => a - b)[
    Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))
  ];
const draft = {
  serviceDescription: "Serviço fictício de carga",
  amountCents: 1000,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF",
    name: "Tomador Fictício",
  },
};
const run = Date.now().toString(36);
const sizes = (process.argv[2] ?? "10,30,100").split(",").map(Number);
const report = [];
let failures = 0;

for (const n of sizes) {
  const keys = Array.from({ length: n }, (_, i) => `carga-${run}-${n}-${i}`);
  const t0 = Date.now();
  const lat = [];
  const calls = keys.flatMap((k) =>
    [0, 1].map(async () => {
      const s = Date.now();
      const r = await A.from("fiscal_requests")
        .insert({
          tenant_id: tenantId,
          created_by: me.user.id,
          idempotency_key: k,
          draft_snapshot: draft,
          draft_hash: k,
        })
        .select("id")
        .maybeSingle();
      lat.push(Date.now() - s);
      return r;
    }),
  );
  const results = await Promise.all(calls);
  const elapsed = Date.now() - t0;
  const created = results.filter((r) => !r.error && r.data).length;
  const dup = results.filter((r) => r.error?.code === "23505").length;
  const other = results.filter(
    (r) => r.error && r.error.code !== "23505",
  ).length;

  const { data: rows } = await admin
    .from("fiscal_requests")
    .select("id")
    .like("idempotency_key", `carga-${run}-${n}-%`);
  const ids = (rows ?? []).map((r) => r.id);
  await admin
    .from("fiscal_requests")
    .update({ status: "AUTORIZADA_PARA_ENVIO" })
    .in("id", ids);
  const t1 = Date.now();
  const alloc = await Promise.all(
    ids.map((id) =>
      admin.rpc("allocate_dps_number", {
        p_request_id: id,
        p_environment: "simulado",
      }),
    ),
  );
  const allocMs = Date.now() - t1;
  const nums = alloc.map((r) => Number(r.data?.[0]?.number));
  const allocErr = alloc.filter((r) => r.error).length;
  const ok =
    created === n &&
    dup === n &&
    other === 0 &&
    ids.length === n &&
    allocErr === 0 &&
    new Set(nums).size === n;
  if (!ok) failures++;
  const row = {
    pedidos: n,
    chamadas: n * 2,
    criados: created,
    duplicidadesRecusadas: dup,
    outrosErros: other,
    tempoTotalMs: elapsed,
    vazaoPorSegundo: Math.round(((n * 2) / elapsed) * 1000),
    latenciaP50Ms: pct(lat, 0.5),
    latenciaP95Ms: pct(lat, 0.95),
    latenciaMaxMs: Math.max(...lat),
    numeracaoMs: allocMs,
    numerosUnicos: new Set(nums).size,
    errosNumeracao: allocErr,
    resultado: ok ? "OK" : "FALHA",
  };
  report.push(row);
  console.log(
    `${ok ? "OK   " : "FALHA"} ${n} pedidos (${n * 2} chamadas): criados ${created}, duplicidades recusadas ${dup}, outros erros ${other}; p50 ${row.latenciaP50Ms} ms, p95 ${row.latenciaP95Ms} ms, máx ${row.latenciaMaxMs} ms; numeração ${allocMs} ms, ${row.numerosUnicos} números únicos`,
  );

  // Limpeza: números, eventos e pedidos de carga (não podem ocupar a fila simulada).
  await admin.from("fiscal_dps_numbers").delete().in("request_id", ids);
  await admin.from("fiscal_request_events").delete().in("request_id", ids);
  await admin.from("fiscal_requests").delete().in("id", ids);
}
const { data: left } = await admin
  .from("fiscal_requests")
  .select("id")
  .like("idempotency_key", `carga-${run}-%`);
console.log(
  `Limpeza: ${(left ?? []).length === 0 ? "ok, nenhum pedido de carga restante" : `${left.length} restante(s)`}`,
);
console.log(JSON.stringify(report));
process.exit(failures || (left ?? []).length ? 1 : 0);
