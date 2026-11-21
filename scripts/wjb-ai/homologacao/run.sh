#!/usr/bin/env bash
# Homologação da migration 0024 num Postgres 17 local, isolado e descartável.
# Nunca toca o Supabase de produção. Uso: bash scripts/wjb-ai/homologacao/run.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
C=wjb-ai-homolog-db
H=scripts/wjb-ai/homologacao
M=supabase/migrations
PSQL() { docker exec -i "$C" psql -v ON_ERROR_STOP=1 -q -U postgres -d "$1"; }

docker rm -f "$C" >/dev/null 2>&1 || true
docker run -d --name "$C" -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" postgres:17-alpine >/dev/null
until docker exec "$C" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
docker exec "$C" psql -q -U postgres -c "create database homolog" >/dev/null

echo "== 1. Schema atual (shim do Supabase + migrations 0001 a 0023)"
PSQL homolog < "$H/00_supabase_shim.sql"
for f in $(ls $M/*.sql | grep -v -e 0024_ -e 0025_ -e 0026_ -e 0027_ -e 0028_ -e 0029_ -e 0030_ -e 0031_ -e 0032_); do PSQL homolog < "$f" >/dev/null; done
PSQL homolog < "$H/01_seed_ficticio.sql" >/dev/null
echo "   ok: $(ls $M/*.sql | grep -v -e 0024_ -e 0025_ -e 0026_ -e 0027_ -e 0028_ -e 0029_ -e 0030_ | wc -l | tr -d ' ') migrations aplicadas"

echo "== 2. Backup e teste de restauração (antes da 0024)"
docker exec "$C" pg_dump -U postgres -Fc -f /tmp/backup_pre_0024.dump homolog
docker exec "$C" psql -q -U postgres -c "create database restore_check" >/dev/null
docker exec "$C" pg_restore -U postgres -d restore_check /tmp/backup_pre_0024.dump
COUNT_SQL="select string_agg(t || '=' || n, ' ' order by t) from (
  select 'tenants' t, count(*) n from public.tenants union all
  select 'profiles', count(*) from public.profiles union all
  select 'tenant_members', count(*) from public.tenant_members union all
  select 'obligations', count(*) from public.obligations union all
  select 'tabelas', count(*) from information_schema.tables where table_schema='public') x"
A=$(docker exec "$C" psql -tA -U postgres -d homolog -c "$COUNT_SQL")
B=$(docker exec "$C" psql -tA -U postgres -d restore_check -c "$COUNT_SQL")
echo "   original:   $A"; echo "   restaurado: $B"
[ "$A" = "$B" ] && echo "   ok: restauração idêntica" || { echo "FALHA na restauração"; exit 1; }

SCHEMA_SQL="select string_agg(table_name||'.'||column_name||':'||data_type, ',' order by table_name, column_name)
  from information_schema.columns where table_schema='public' and table_name not like 'fiscal_%' and table_name not like 'commercial_%'"
BEFORE=$(docker exec "$C" psql -tA -U postgres -d homolog -c "$SCHEMA_SQL")

echo "== 3. Aplicando 0024 a 0032"
PSQL homolog < "$M/0024_wjb_ai_fiscal_core.sql"
PSQL homolog < "$M/0025_wjb_ai_fiscal_queue.sql"
PSQL homolog < "$M/0026_wjb_ai_fiscal_request_versions.sql"
PSQL homolog < "$M/0027_wjb_ai_dps_numbering_and_emitter.sql"
PSQL homolog < "$M/0028_wjb_ai_certificate_usage.sql"
PSQL homolog < "$M/0029_wjb_ai_review_assignment.sql"
PSQL homolog < "$M/0030_wjb_commercial_plans.sql"
PSQL homolog < "$M/0031_wjb_commercial_entitlement_grant.sql"
PSQL homolog < "$M/0032_wjb_commercial_price_approval.sql"
AFTER=$(docker exec "$C" psql -tA -U postgres -d homolog -c "$SCHEMA_SQL")
[ "$BEFORE" = "$AFTER" ] && echo "   ok: nenhuma coluna de tabela existente mudou" || { echo "FALHA: tabelas existentes alteradas"; exit 1; }
echo "   tabelas novas: $(docker exec "$C" psql -tA -U postgres -d homolog -c "select string_agg(table_name, ', ' order by table_name) from information_schema.tables where table_schema='public' and table_name like 'fiscal_%'")"
echo "   RLS ligada em: $(docker exec "$C" psql -tA -U postgres -d homolog -c "select count(*) from pg_tables where schemaname='public' and tablename like 'fiscal_%' and rowsecurity")/11 (fiscal_*)"

echo "== 4. Testes de RLS, isolamento, permissões e integridade"
PSQL homolog < "$H/02_testes_0024.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'
echo "   0025: $(docker exec "$C" psql -tA -U postgres -d homolog -c "select count(*) from information_schema.columns where table_name='fiscal_requests' and column_name in ('attempt_count','next_attempt_at','last_error','needs_intervention')")/4 colunas novas"

echo "== 4b. 0027: série, numeração concorrente da DPS e autorização de emissão"
PSQL homolog < "$H/07_testes_0027.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'
PIDS=""
for i in $(seq 1 20); do
  id="c0000000-0000-4000-8000-$(printf '%012d' "$i")"
  docker exec "$C" psql -q -U postgres -d homolog -c "set role service_role; select * from public.allocate_dps_number('$id','simulado')" >/dev/null & PIDS="$PIDS $!"
done
for i in $(seq 1 10); do
  docker exec "$C" psql -q -U postgres -d homolog -c "set role service_role; select * from public.allocate_dps_number('c0000000-0000-4000-8000-000000000001','simulado')" >/dev/null & PIDS="$PIDS $!"
done
for p in $PIDS; do wait "$p" || { echo "FALHA numa chamada concorrente"; exit 1; }; done
echo "   30 chamadas concorrentes (20 pedidos + 10 repetições do pedido 1) concluídas"
PSQL homolog < "$H/08_verifica_0027.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'

echo "== 4c. 0028: trilha de uso do certificado"
PSQL homolog < "$H/10_testes_0028.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'

echo "== 4d. 0029: atribuição, prioridade e prazo da revisão"
PSQL homolog < "$H/12_testes_0029.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'

echo "== 4e. 0030: comercial (catálogo rascunho, assinatura simulada, ledger)"
echo "   RLS nas tabelas commercial_*: $(docker exec "$C" psql -tA -U postgres -d homolog -c "select count(*) from pg_tables where schemaname='public' and tablename like 'commercial_%' and rowsecurity")/8"
PSQL homolog < "$H/14_testes_0030.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'
echo "== 4f. 0032: aprovação versionada de preço"
PSQL homolog < "$H/16_testes_0032.sql" 2>&1 | sed -n 's/^.*NOTICE:  /   /p'

echo "== 5. Rollback da 0032 a 0024 (no banco restaurado)"
PSQL restore_check < "$M/0024_wjb_ai_fiscal_core.sql"
PSQL restore_check < "$M/0025_wjb_ai_fiscal_queue.sql"
PSQL restore_check < "$M/0026_wjb_ai_fiscal_request_versions.sql"
PSQL restore_check < "$M/0027_wjb_ai_dps_numbering_and_emitter.sql"
PSQL restore_check < "$M/0028_wjb_ai_certificate_usage.sql"
PSQL restore_check < "$M/0029_wjb_ai_review_assignment.sql"
PSQL restore_check < "$M/0030_wjb_commercial_plans.sql"
PSQL restore_check < "$M/0031_wjb_commercial_entitlement_grant.sql"
PSQL restore_check < "$M/0032_wjb_commercial_price_approval.sql"
PSQL restore_check < "$H/17_rollback_0032.sql"
PSQL restore_check < "$H/15_rollback_0031.sql"
PSQL restore_check < "$H/13_rollback_0030.sql"
PSQL restore_check < "$H/11_rollback_0029.sql"
PSQL restore_check < "$H/09_rollback_0028.sql"
PSQL restore_check < "$H/06_rollback_0027.sql"
PSQL restore_check < "$H/05_rollback_0026.sql"
PSQL restore_check < "$H/04_rollback_0025.sql"
PSQL restore_check < "$H/03_rollback_0024.sql"
R=$(docker exec "$C" psql -tA -U postgres -d restore_check -c "$COUNT_SQL")
RS=$(docker exec "$C" psql -tA -U postgres -d restore_check -c "$SCHEMA_SQL")
[ "$R" = "$A" ] && [ "$RS" = "$BEFORE" ] && echo "   ok: rollback devolve o banco ao estado anterior" || { echo "FALHA no rollback"; exit 1; }

[ "${KEEP:-0}" = "1" ] || docker rm -f "$C" >/dev/null
echo "== Homologação concluída sem falhas"
