#!/usr/bin/env bash
# Auditoria responsiva da Fase 8 contra o build local de STAGING (homologação,
# usuários fictícios). Reaproveita o ambiente do staging.sh. Nunca aponta para
# produção. Uso: bash scripts/wjb-ai/qa/responsivo.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
node -e 'import("./scripts/wjb-ai/homologacao-supabase/env.mjs").then(m => m.loadHomologEnv({ needDb: false }))'
set -a; . ./.env.homolog.local; . ./.env.homolog.users.local; set +a
export SUPABASE_URL="$HOMOLOG_SUPABASE_URL" SUPABASE_ANON_KEY="$HOMOLOG_SUPABASE_ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$HOMOLOG_SUPABASE_SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="$HOMOLOG_SUPABASE_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$HOMOLOG_SUPABASE_ANON_KEY"
export WJB_AI_ENABLED=true WJB_AI_FISCAL_MODE=mock SAAS_PUBLIC_ENABLED=true NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true WJB_COMMERCIAL_ENABLED=true
unset GCLICK_REAL_INTEGRATION_ENABLED RESEND_API_KEY || true
export RESPONSIVE_AUDIT=1
pkill -f next-server 2>/dev/null || true
if [ "${SKIP_BUILD:-0}" != "1" ]; then npm run build > /tmp/wjb-qa-build.log 2>&1 || { echo "build falhou"; exit 1; }; fi
(npx next start -p 3000 > /tmp/wjb-qa-start.log 2>&1 &)
sleep 6
set +e
npx playwright test src/tests/e2e/responsive-audit.spec.ts --workers=1 --reporter=line --project=chromium
status=$?
pkill -f next-server 2>/dev/null || true
echo "Lembrete: rode 'npm run build' antes de testar contra produção."
exit $status
