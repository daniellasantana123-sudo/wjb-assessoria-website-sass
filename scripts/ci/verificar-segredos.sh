#!/usr/bin/env bash
# Detecção de segredos nos arquivos VERSIONADOS (Fase 10E). Sem ferramenta de
# terceiros. Falha se encontrar material de chave ou credencial real.
# - Chave privada só conta com conteúdo base64 depois do cabeçalho (a busca
#   atravessa linhas): fixtures de teste e documentação citam só o cabeçalho.
# - A chave de EXEMPLO da documentação da AWS (AKIAIOSFODNN7EXAMPLE) é a única
#   chave de acesso AWS aceita.
set -uo pipefail
cd "$(dirname "$0")/../.."
SELF='scripts/ci/verificar-segredos.sh'
TOKENS='sk_live_[0-9A-Za-z]{10,}|rk_live_[0-9A-Za-z]{10,}|sk_test_[0-9A-Za-z]{24,}|whsec_[0-9A-Za-z]{30,}|sb_secret_[0-9A-Za-z_-]{20,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIs[0-9A-Za-z_.-]{20,}|re_[0-9A-Za-z]{8}_[0-9A-Za-z]{20,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{50,}|xox[baprs]-[0-9A-Za-z-]{10,}'
fail=0

files=$(git ls-files | grep -iE '\.(pfx|p12|key|pem|crt|cer|der|jks)$' || true)
[ -n "$files" ] && { echo "Arquivo de certificado/chave versionado:"; echo "$files"; fail=1; }
envs=$(git ls-files | grep -E '(^|/)\.env' | grep -vE '\.env\.example$' || true)
[ -n "$envs" ] && { echo "Arquivo .env versionado:"; echo "$envs"; fail=1; }

while IFS= read -r f; do
  [ "$f" = "$SELF" ] && continue
  [ -f "$f" ] || continue
  if grep -oIE -- "$TOKENS" "$f" 2>/dev/null | grep -qv '^AKIAIOSFODNN7EXAMPLE$'; then
    echo "Possível credencial em: $f"
    fail=1
  fi
  if grep -qI -- 'PRIVATE KEY-----' "$f" 2>/dev/null &&
    perl -0777 -ne 'exit(/-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+\/]{60}/ ? 0 : 1)' "$f"; then
    echo "Chave privada em: $f"
    fail=1
  fi
done < <(git ls-files)

if [ "$fail" -eq 0 ]; then echo "Segredos: nenhum encontrado."; else echo "Segredos: revisar os itens acima."; fi
exit "$fail"
