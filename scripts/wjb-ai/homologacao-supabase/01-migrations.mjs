// Aplica supabase/migrations em ordem no banco de HOMOLOGAÇÃO, com registro
// próprio (homolog_meta.applied) e detecção de divergência por sha256.
// Antes de aplicar qualquer migration nova, faz backup (pg_dump) local.
// Uso: node scripts/wjb-ai/homologacao-supabase/01-migrations.mjs [--ate 0023]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadHomologEnv, projectRef, ROOT } from "./env.mjs";

const env = process.env.HOMOLOG_DB_URL_OVERRIDE
  ? { HOMOLOG_DB_URL: process.env.HOMOLOG_DB_URL_OVERRIDE, HOMOLOG_SUPABASE_URL: "https://localdockertestxxxxxx.supabase.co" }
  : loadHomologEnv();
const ate = process.argv.includes("--ate") ? process.argv[process.argv.indexOf("--ate") + 1] : null;
const MIG = path.join(ROOT, "supabase/migrations");
const BACKUPS = path.join(ROOT, ".homolog-backups");
const NETWORK = process.env.HOMOLOG_DOCKER_NETWORK ?? "bridge";

function docker(args, input) {
  return execFileSync(
    "docker",
    ["run", "--rm", "-i", "--network", NETWORK, "-e", "PGURL", "-v", `${MIG}:/mig:ro`, "-v", `${BACKUPS}:/backup`, "postgres:17-alpine", "sh", "-c", args],
    { input, env: { ...process.env, PGURL: env.HOMOLOG_DB_URL }, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" },
  );
}
const psql = (sql) => docker('psql "$PGURL" -v ON_ERROR_STOP=1 -tA -q', sql).trim();

mkdirSync(BACKUPS, { recursive: true });
console.log(`Projeto de homologação: ${projectRef(env)}`);

psql(`create schema if not exists homolog_meta;
create table if not exists homolog_meta.applied (name text primary key, sha256 text not null, applied_at timestamptz default now());`);
const applied = new Map(
  psql("select name || '|' || sha256 from homolog_meta.applied")
    .split("\n").filter(Boolean).map((l) => l.split("|")),
);

const files = readdirSync(MIG).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const pending = [];
for (const f of files) {
  if (ate && f.slice(0, 4) > ate) break;
  const sha = createHash("sha256").update(readFileSync(path.join(MIG, f))).digest("hex");
  if (applied.has(f)) {
    if (applied.get(f) !== sha) throw new Error(`DIVERGÊNCIA: ${f} foi alterada depois de aplicada.`);
    continue;
  }
  pending.push([f, sha]);
}
if (!pending.length) { console.log("Nada a aplicar; registro coerente com o repositório."); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
docker(`pg_dump "$PGURL" -Fc -n public -n homolog_meta -f /backup/antes-${pending[0][0].slice(0, 4)}-${stamp}.dump`);
console.log(`Backup feito antes de aplicar (${pending.length} migration(s)).`);

for (const [f, sha] of pending) {
  docker(`psql "$PGURL" -v ON_ERROR_STOP=1 -q --single-transaction -f /mig/${f}`);
  psql(`insert into homolog_meta.applied (name, sha256) values ('${f}', '${sha}')`);
  console.log(`  ok ${f}`);
}
