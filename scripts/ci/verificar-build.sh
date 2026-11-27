#!/usr/bin/env bash
# Segurança do artefato de build (Fase 10E): o que vai para o NAVEGADOR
# (.next/static) não pode citar segredos de servidor nem trazer source maps.
# Rodar depois de `npm run build`.
set -uo pipefail
cd "$(dirname "$0")/../.."
[ -d .next/static ] || { echo "Rode npm run build antes."; exit 2; }
fail=0
NAMES='SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CRON_SECRET|GCLICK_CLIENT_SECRET|HOMOLOG_SUPABASE|AWS_SECRET_ACCESS_KEY|service_role'
hits=$(grep -rlE "$NAMES" .next/static 2>/dev/null || true)
[ -n "$hits" ] && { echo "Nome de segredo de servidor no código do navegador:"; echo "$hits" | head; fail=1; }
maps=$(find .next/static -name '*.map' | head -5)
[ -n "$maps" ] && { echo "Source maps publicados:"; echo "$maps"; fail=1; }
keys=$(grep -rlE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_|sb_secret_' .next/static 2>/dev/null || true)
[ -n "$keys" ] && { echo "Material de chave no código do navegador:"; echo "$keys" | head; fail=1; }
[ "$fail" -eq 0 ] && echo "Build: nenhum segredo nem source map no código do navegador." || true
exit "$fail"
