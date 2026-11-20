// Backup do banco de HOMOLOGAÇÃO e prova de restauração: faz pg_dump do
// esquema public (+ usuários de auth.users), restaura num Postgres 17 local
// descartável e compara a contagem de linhas de cada tabela.
// Uso: node scripts/wjb-ai/homologacao-supabase/03-backup-restauracao.mjs
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { loadHomologEnv, projectRef, ROOT } from "./env.mjs";

const env = process.env.HOMOLOG_DB_URL_OVERRIDE
  ? { HOMOLOG_DB_URL: process.env.HOMOLOG_DB_URL_OVERRIDE, HOMOLOG_SUPABASE_URL: "https://localdockertestxxxxxx.supabase.co" }
  : loadHomologEnv();
const NETWORK = process.env.HOMOLOG_DOCKER_NETWORK ?? "wjb-homolog-restore";
const BACKUPS = path.join(ROOT, ".homolog-backups");
const SHIM = readFileSync(path.join(ROOT, "scripts/wjb-ai/homologacao/00_supabase_shim.sql"), "utf8");
mkdirSync(BACKUPS, { recursive: true });

const run = (url, cmd, input) =>
  execFileSync("docker", ["run", "--rm", "-i", "--network", NETWORK, "-e", "PGURL", "-v", `${BACKUPS}:/backup`, "postgres:17-alpine", "sh", "-c", cmd], {
    input, env: { ...process.env, PGURL: url }, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
const COUNT = `select string_agg(relname || '=' || n, ' ' order by relname) from (
  select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text as n
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r') t`;

if (!process.env.HOMOLOG_DOCKER_NETWORK) execSync(`docker network create ${NETWORK} 2>/dev/null || true`);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dump = `homolog-${stamp}.dump`;
console.log(`Projeto de homologação: ${projectRef(env)}`);

run(env.HOMOLOG_DB_URL, `pg_dump "$PGURL" -Fc -n public --no-owner --no-privileges -f /backup/${dump}`);
run(env.HOMOLOG_DB_URL, `psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "\\copy (select id, email, raw_user_meta_data from auth.users) to '/backup/${dump}.users.csv' csv"`);
const original = run(env.HOMOLOG_DB_URL, `psql "$PGURL" -tA -c "${COUNT.replace(/"/g, '\\"')}"`).trim();
console.log("1. Backup gerado (.homolog-backups/, fora do Git).");

const name = `wjb-restore-${randomBytes(3).toString("hex")}`;
const pw = randomBytes(12).toString("hex");
execSync(`docker run -d --name ${name} --network ${NETWORK} -e POSTGRES_PASSWORD=${pw} postgres:17-alpine`, { stdio: "ignore" });
try {
  execSync(`until docker exec ${name} pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done; sleep 2`);
  const target = `postgresql://postgres:${pw}@${name}:5432/postgres`;
  run(target, 'psql "$PGURL" -q -v ON_ERROR_STOP=1', SHIM);
  run(target, `psql "$PGURL" -q -v ON_ERROR_STOP=1 -c "\\copy auth.users (id, email, raw_user_meta_data) from '/backup/${dump}.users.csv' csv"`);
  // `pg_attver` é parâmetro interno de coluna do Postgres do Supabase; um
  // Postgres padrão não o reconhece e recusaria o bloco inteiro da tabela.
  // Só essas linhas são removidas; qualquer outro erro reprova o teste.
  run(target, `pg_restore -f - --no-owner --no-privileges /backup/${dump} | sed '/SET (pg_attver=/d' | psql "$PGURL" -q 2>/backup/${dump}.restore.log >/dev/null || true`);
  const errors = readFileSync(path.join(BACKUPS, `${dump}.restore.log`), "utf8").split("\n").filter((l) => /ERROR/.test(l) && !/schema "public" already exists/.test(l));
  if (errors.length) throw new Error(`FALHA: ${errors.length} erro(s) na restauração (ver .homolog-backups/${dump}.restore.log)`);
  const restored = run(target, `psql "$PGURL" -tA -c "${COUNT.replace(/"/g, '\\"')}"`).trim();
  console.log(`2. Original:   ${original}`);
  console.log(`   Restaurado: ${restored}`);
  if (original !== restored) throw new Error("FALHA: a restauração não reproduziu as mesmas contagens.");
  console.log("3. ok: restauração idêntica em contagem de linhas por tabela.");
} finally {
  execSync(`docker rm -f ${name}`, { stdio: "ignore" });
}
