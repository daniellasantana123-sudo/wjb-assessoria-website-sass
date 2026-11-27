#!/usr/bin/env bash
# Fase 10H: alerta de rotina que DEIXA DE EXECUTAR, mesmo sem registrar erro.
# Confere, pela API do GitHub, a última execução BEM-SUCEDIDA de cada rotina
# agendada. Falha (código 1) se passou mais tempo que o limite. Cobre:
# atraso excessivo do agendador do GitHub, workflow desligado, agendamento
# suspenso pelo GitHub (repositório sem atividade por 60 dias) e falhas
# seguidas. Não lê conteúdo de log; só datas e situação das execuções.
# Uso: verificar-execucao-rotinas.sh   (GH_TOKEN com actions: read)
set -euo pipefail
REPO="${GITHUB_REPOSITORY:?}"
# arquivo do workflow : horas máximas sem sucesso
ROTINAS="${ROTINAS:-lembretes-obrigacoes.yml:36}"
agora=$(date -u +%s)
falhas=0
for item in $ROTINAS; do
  wf="${item%%:*}"; max="${item##*:}"
  ultimo=$(gh api "repos/$REPO/actions/workflows/$wf/runs?status=success&per_page=1" --jq '.workflow_runs[0].created_at // empty' 2>/dev/null) || ultimo=""
  estado=$(gh api "repos/$REPO/actions/workflows/$wf" --jq '.state' 2>/dev/null) || estado="nao_encontrado"
  [[ "$ultimo" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || ultimo=""
  if [ -z "$ultimo" ]; then
    echo "FALHA $wf: nenhuma execução bem-sucedida encontrada (estado do workflow: $estado)"; falhas=$((falhas + 1)); continue
  fi
  t=$(date -u -d "$ultimo" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$ultimo" +%s)
  horas=$(( (agora - t) / 3600 ))
  if [ "$estado" != "active" ]; then
    echo "FALHA $wf: workflow com estado '$estado' (agendamento parado)"; falhas=$((falhas + 1))
  elif [ "$horas" -gt "$max" ]; then
    echo "FALHA $wf: última execução bem-sucedida há ${horas} h (limite ${max} h)"; falhas=$((falhas + 1))
  else
    echo "OK    $wf: última execução bem-sucedida há ${horas} h"
  fi
done
exit "$falhas"
