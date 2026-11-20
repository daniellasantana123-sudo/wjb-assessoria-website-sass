#!/usr/bin/env bash
# STAGING local: build de produção do site apontando para o Supabase de
# HOMOLOGAÇÃO, com o módulo WJB AI ligado só aqui, e roda os E2E com login
# real dos usuários fictícios. Nada é publicado. Nunca imprime segredos.
# Uso: bash scripts/wjb-ai/homologacao-supabase/staging.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
node -e 'import("./scripts/wjb-ai/homologacao-supabase/env.mjs").then(m => m.loadHomologEnv({ needDb: false }))'
[ -f .env.homolog.users.local ] || { echo "Rode antes o 02-seed-e-testes-api.mjs"; exit 1; }
set -a; . ./.env.homolog.local; . ./.env.homolog.users.local; set +a

export SUPABASE_URL="$HOMOLOG_SUPABASE_URL" SUPABASE_ANON_KEY="$HOMOLOG_SUPABASE_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$HOMOLOG_SUPABASE_SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="$HOMOLOG_SUPABASE_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$HOMOLOG_SUPABASE_ANON_KEY"
export WJB_AI_ENABLED=true WJB_AI_FISCAL_MODE=mock SAAS_PUBLIC_ENABLED=true NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true
# Integrações externas desligadas no staging: G-Click em mock, sem e-mail, sem WhatsApp.
unset GCLICK_REAL_INTEGRATION_ENABLED RESEND_API_KEY WHATSAPP_ACCESS_TOKEN || true
export HOMOLOG_STAGING=1

pkill -f next-server 2>/dev/null || true
npm run build > /tmp/wjb-staging-build.log 2>&1 || { echo "build falhou (ver /tmp/wjb-staging-build.log)"; exit 1; }
(npx next start -p 3000 > /tmp/wjb-staging-start.log 2>&1 &)
sleep 6
npx playwright test src/tests/e2e/staging-nfse.spec.ts --reporter=line
status=$?
pkill -f next-server 2>/dev/null || true
echo "Lembrete: rode 'npm run build' de novo antes de testar contra produção (o build atual aponta para a homologação)."
exit $status
