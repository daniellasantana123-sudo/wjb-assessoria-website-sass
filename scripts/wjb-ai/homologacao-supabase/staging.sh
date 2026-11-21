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
# Fases 8/9: comercialização SIMULADA só neste build local (WhatsApp é Click-to-Chat, sem API).
export WJB_COMMERCIAL_ENABLED=true
# Integrações externas desligadas no staging: G-Click em mock, sem e-mail, sem WhatsApp.
unset GCLICK_REAL_INTEGRATION_ENABLED RESEND_API_KEY WHATSAPP_ACCESS_TOKEN || true
export HOMOLOG_STAGING=1
# Segredo só desta execução, para a rota agendada da fila simulada.
export CRON_SECRET="$(openssl rand -hex 24)"

node -e 'import("@supabase/supabase-js").then(async ({createClient}) => { const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); await c.from("rate_limit_buckets").delete().like("bucket", "leads:%"); })'
node scripts/wjb-ai/homologacao-supabase/08-mfa-usuarios.mjs > /tmp/wjb-staging-mfa.log 2>&1 || { echo "MFA dos usuários de teste falhou (ver /tmp/wjb-staging-mfa.log)"; exit 1; }
node scripts/wjb-ai/homologacao-supabase/05-comercial-catalogo.mjs > /tmp/wjb-staging-comercial.log 2>&1 || { echo "cenário comercial falhou (ver /tmp/wjb-staging-comercial.log)"; exit 1; }
pkill -f next-server 2>/dev/null || true
npm run build > /tmp/wjb-staging-build.log 2>&1 || { echo "build falhou (ver /tmp/wjb-staging-build.log)"; exit 1; }
(npx next start -p 3000 > /tmp/wjb-staging-start.log 2>&1 &)
sleep 6
npx playwright test src/tests/e2e/staging-nfse.spec.ts src/tests/e2e/staging-nfse-admin.spec.ts src/tests/e2e/staging-nfse-fase7.spec.ts src/tests/e2e/staging-nfse-fase8.spec.ts src/tests/e2e/staging-nfse-fase9.spec.ts src/tests/e2e/staging-fase10a.spec.ts --workers=1 --reporter=line
status=$?
pkill -f next-server 2>/dev/null || true

# Fase 9.1 (mesmo build; interruptores são lidos em runtime):
# 1) pagamentos com o provedor SIMULADO (sem Stripe, sem dinheiro);
node scripts/wjb-ai/homologacao-supabase/05-comercial-catalogo.mjs > /tmp/wjb-staging-comercial.log 2>&1
(WJB_PAYMENTS_ENABLED=true WJB_PAYMENTS_PROVIDER=mock npx next start -p 3000 > /tmp/wjb-staging-start-pay.log 2>&1 &)
sleep 6
HOMOLOG_PAYMENTS=mock npx playwright test src/tests/e2e/staging-payments.spec.ts --workers=1 --reporter=line
s2=$?
pkill -f next-server 2>/dev/null || true
# 2) rota do webhook em modo stripe_test com segredos de FORMATO gerados agora
#    (não são credenciais da Stripe; os testes não chamam a API da Stripe).
export STRIPE_SECRET_KEY="sk_test_formato$(openssl rand -hex 12)" STRIPE_WEBHOOK_SECRET="whsec_formato$(openssl rand -hex 12)"
(WJB_PAYMENTS_ENABLED=true WJB_PAYMENTS_PROVIDER=stripe_test npx next start -p 3000 > /tmp/wjb-staging-start-wh.log 2>&1 &)
sleep 6
HOMOLOG_PAYMENTS=stripe_test_format npx playwright test src/tests/e2e/staging-payments-webhook.spec.ts --workers=1 --reporter=line
s3=$?
unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
pkill -f next-server 2>/dev/null || true
[ $status -eq 0 ] && [ $s2 -eq 0 ] && [ $s3 -eq 0 ] || status=1
echo "Lembrete: rode 'npm run build' de novo antes de testar contra produção (o build atual aponta para a homologação)."
exit $status
