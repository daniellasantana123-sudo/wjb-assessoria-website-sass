// Verifica .env.homolog.local SEM imprimir valores: formato das chaves, se
// tudo aponta para o MESMO projeto (e não para a produção) e conexão
// somente leitura (Auth, PostgREST, Postgres). Não altera nada.
// Uso: node scripts/wjb-ai/homologacao-supabase/00-verificar-config.mjs
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

import { loadHomologEnv, projectRef, ROOT } from "./env.mjs";

const env = loadHomologEnv();
const ref = projectRef(env);
const out = [];
const ok = (cond, label) => { out.push(`${cond ? "OK   " : "FALHA"} ${label}`); return cond; };

const mode = (statSync(path.join(ROOT, ".env.homolog.local")).mode & 0o777).toString(8);
ok(mode === "600", `permissão do arquivo = ${mode} (esperado 600)`);
ok(/^(sb_publishable_|eyJ)/.test(env.HOMOLOG_SUPABASE_ANON_KEY), "chave publicável no formato esperado");
ok(/^(sb_secret_|eyJ)/.test(env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY), "chave secreta no formato esperado");
ok(!env.HOMOLOG_SUPABASE_ANON_KEY.startsWith("sb_secret_"), "chave publicável não é a secreta trocada de lugar");
let db;
try { db = new URL(env.HOMOLOG_DB_URL); } catch { db = null; }
ok(!!db && /^postgres(ql)?:$/.test(db.protocol), "string de conexão é postgresql://");
ok(!!db && (db.username.endsWith(`.${ref}`) || db.hostname.includes(ref)), "string de conexão é do MESMO projeto da URL");
ok(!!db && !db.password.includes("YOUR-PASSWORD") && db.password.length > 0, "senha preenchida na string de conexão");

const h = await fetch(`${env.HOMOLOG_SUPABASE_URL}/auth/v1/health`, { headers: { apikey: env.HOMOLOG_SUPABASE_ANON_KEY } });
ok(h.ok, `Auth respondendo (HTTP ${h.status})`);
const r = await fetch(`${env.HOMOLOG_SUPABASE_URL}/rest/v1/tenants?select=id&limit=1`, {
  headers: { apikey: env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY}` },
});
out.push(`INFO  PostgREST com a chave secreta: HTTP ${r.status} ${r.status === 404 ? "(tabela ainda não existe - esperado antes das migrations)" : ""}`);

let info = "";
const sql = `select 'versao=' || current_setting('server_version')
  || ' | banco=' || current_database()
  || ' | usuario=' || current_user
  || ' | historico_migrations=' || case when to_regclass('supabase_migrations.schema_migrations') is null then 'sem tabela'
      else (xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations', false, true, '')))[1]::text end
  || ' | tabelas_public=' || (select count(*) from information_schema.tables where table_schema='public')
  || ' | auth.users=' || (select count(*) from auth.users)
  || ' | somente_leitura_ok=' || (current_setting('transaction_read_only'))`;
try {
  info = execFileSync("docker", ["run", "--rm", "-e", "PGURL", "postgres:17-alpine", "sh", "-c",
    `psql "$PGURL" -tA -v ON_ERROR_STOP=1 -c "begin read only;" -c "${sql.replace(/"/g, '\\"')}" -c "rollback;" 2>&1`],
    { env: { ...process.env, PGURL: env.HOMOLOG_DB_URL }, encoding: "utf8" }).trim();
  info = info.split("\n").find((l) => l.startsWith("versao=")) ?? info;
  ok(info.startsWith("versao="), "Postgres conectado (transação somente leitura)");
} catch (e) {
  // A mensagem do psql pode citar host/usuário; mostramos só o tipo do erro.
  const msg = String(e.stdout ?? e.message);
  info = /password authentication failed/.test(msg) ? "senha incorreta"
    : /could not translate host|Name or service not known/.test(msg) ? "host não encontrado"
    : /relation "supabase_migrations/.test(msg) ? "sem esquema supabase_migrations"
    : "falha de conexão";
  ok(false, `Postgres: ${info}`);
}
console.log(`Projeto: ${ref}\n${out.join("\n")}${info.startsWith("versao=") ? `\nINFO  ${info}` : ""}`);
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
