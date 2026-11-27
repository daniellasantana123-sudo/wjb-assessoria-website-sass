#!/usr/bin/env bash
# Monitoramento SOMENTE LEITURA da produção (Fase 10E). Não envia lead, não
# faz login, não muda nada. Só GET/HEAD públicos e uma POST com corpo vazio
# na API de contato (que deve ser recusada com 400, sem gravar nada).
# Uso: bash scripts/wjb-ai/producao/monitorar.sh [--servidor]
#   --servidor: também conta linhas de erro nos logs da aplicação via SSH
#   (alias wjb-hostinger), sem exibir conteúdo de log.
set -uo pipefail
MODE=${1:-}
B=${WJB_MONITOR_URL:-https://wjbassessoriacontabil.com.br}
fail=0
ok() { printf "OK    %s\n" "$1"; }
bad() { printf "FALHA %s\n" "$1"; fail=$((fail + 1)); }
code() { curl -s -o /dev/null -w '%{http_code}' -m 30 "$1"; }

echo "== Disponibilidade e desempenho ($B)"
for u in / /contato /planos /servicos /blog /sobre /duvidas /area-do-cliente /ajuda /login /sitemap.xml /robots.txt; do
  r=$(curl -s -o /dev/null -w '%{http_code} %{time_starttransfer} %{time_total}' -m 30 "$B$u?mon=$RANDOM")
  set -- $r
  if [ "$1" = "200" ]; then ok "$u 200 (TTFB ${2}s, total ${3}s)"; else bad "$u respondeu $1"; fi
  awk -v t="$3" 'BEGIN{exit !(t>5)}' && bad "$u lento: ${3}s"
done

echo "== Áreas autenticadas protegidas"
for u in /portal /admin /portal/nfse /admin/nfse /admin/manual; do
  r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -m 30 "$B$u")
  case "$r" in 307*"/login?next="*) ok "$u exige login";; *) bad "$u: $r";; esac
done

echo "== Redirecionamentos"
check_redir() { r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -m 30 "$1"); case "$r" in "$2"*"$3"*) ok "$1 -> $3";; *) bad "$1: $r";; esac; }
check_redir "https://www.wjbassessoriacontabil.com.br/" 308 "https://wjbassessoriacontabil.com.br/"
check_redir "$B/home" 308 "$B/"
[ "$(curl -s -o /dev/null -L -w '%{http_code}' -m 30 "$B/wp-admin/")" = "410" ] && ok "/wp-admin 410" || bad "/wp-admin não responde 410"
[ "$(code "$B/nao-existe-$RANDOM")" = "404" ] && ok "página inexistente 404" || bad "página inexistente não é 404"

echo "== Cabeçalhos de segurança (3 leituras, sem cache)"
for i in 1 2 3; do
  h=$(curl -s -D - -o /dev/null -m 30 "$B/contato?mon=$RANDOM$i")
  miss=""
  for k in content-security-policy strict-transport-security x-frame-options x-content-type-options referrer-policy permissions-policy; do
    echo "$h" | grep -qi "^$k:" || miss="$miss $k"
  done
  [ -z "$miss" ] && ok "leitura $i: 6 cabeçalhos" || bad "leitura $i sem:$miss"
done

echo "== Formulário comercial (validação, nada é gravado)"
r=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST "$B/api/leads" -H 'content-type: application/json' -d '{}')
[ "$r" = "400" ] && ok "API de contato recusa dado inválido (400)" || bad "API de contato respondeu $r para corpo vazio"
grep_form=$(curl -s -m 30 "$B/contato" | grep -o '<form[^>]*method="post"' | head -1)
[ -n "$grep_form" ] && ok "formulário de contato com method=post" || echo "AVISO formulário sem method=post (correção da Fase 10E ainda não publicada)"

echo "== Imagens"
img=$(curl -s -m 30 "$B/" | grep -o '/_next/image?url=[^"&]*&amp;w=[0-9]*&amp;q=[0-9]*' | head -1 | sed 's/&amp;/\&/g')
[ -n "$img" ] && [ "$(code "$B$img")" = "200" ] && ok "otimizador de imagens" || bad "otimizador de imagens"

if [ "$MODE" = "--servidor" ]; then
  echo "== Logs da aplicação (só contagens)"
  ssh -o ConnectTimeout=15 wjb-hostinger 'cd domains/wjbassessoriacontabil.com.br/hbuilds && v=$(readlink current); f=$v/nodejs/console.log; echo "versao_ativa=${v#versions/}"; echo "stderr_linhas=$(wc -l < $v/nodejs/stderr.log)"; echo "erros=$(grep -c "\"level\":\"ERROR\"" $f)"; echo "erros_exceto_ocioso=$(grep "\"level\":\"ERROR\"" $f | grep -vc "no request in 300 seconds")"; echo "versoes_no_servidor=$(ls versions | wc -l)"; echo "previas=$(grep -l "Mode: *preview" logs/*/*deploy.log 2>/dev/null | wc -l)"' 2>&1
fi

echo
[ "$fail" -eq 0 ] && echo "Monitoramento: sem falhas." || echo "Monitoramento: $fail falha(s)."
exit "$fail"
