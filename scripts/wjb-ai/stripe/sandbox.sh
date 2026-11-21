#!/usr/bin/env bash
# Fase 9.1: testes REAIS no Sandbox da Stripe (modo de teste) + Supabase de
# HOMOLOGAÇÃO. Exige .env.stripe.local com chaves de TESTE (gravado por
# configurar-chaves.mjs). Recusa chave live. Não usa a produção.
# Uso: bash scripts/wjb-ai/stripe/sandbox.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -f .env.stripe.local ] || { echo "Falta .env.stripe.local: rode node scripts/wjb-ai/stripe/configurar-chaves.mjs"; exit 1; }
node -e 'import("./scripts/wjb-ai/homologacao-supabase/env.mjs").then(m => m.loadHomologEnv({ needDb: false }))'
set -a; . ./.env.homolog.local; . ./.env.homolog.users.local; . ./.env.stripe.local; set +a
if grep -qE '^STRIPE_[A-Z_]+=(sk|rk|pk)_live_' .env.stripe.local; then echo "Chave LIVE encontrada: abortado."; exit 1; fi
export SUPABASE_URL="$HOMOLOG_SUPABASE_URL" SUPABASE_ANON_KEY="$HOMOLOG_SUPABASE_ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$HOMOLOG_SUPABASE_SERVICE_ROLE_KEY"
export WJB_COMMERCIAL_ENABLED=true WJB_PAYMENTS_ENABLED=true WJB_PAYMENTS_PROVIDER=stripe_test STRIPE_SANDBOX=1
node scripts/wjb-ai/homologacao-supabase/05-comercial-catalogo.mjs > /tmp/wjb-sandbox-comercial.log 2>&1
npx vitest run --config vitest.sandbox.config.mts --reporter=verbose
