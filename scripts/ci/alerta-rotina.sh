#!/usr/bin/env bash
# Fase 10F: alerta de rotina crítica pelo próprio GitHub (sem serviço pago).
#
# A rotina de lembretes falhou 44 dias seguidos (13/10 a 25/11/2026) sem que
# ninguém soubesse. Agora cada rotina chama este script no fim:
#   falha   -> abre um issue "Falha na rotina: <nome>" (ou comenta no aberto)
#   sucesso -> se havia issue aberto, comenta que voltou e fecha
# O GitHub notifica por e-mail quem acompanha o repositório (o dono, por
# padrão). Nunca escreve conteúdo de resposta ou segredo no issue: só o nome
# da rotina, o resultado e o link da execução.
#
# Uso: alerta-rotina.sh <nome-da-rotina> <success|failure>
# Requer GH_TOKEN (o GITHUB_TOKEN do workflow, com permissão issues: write).
# ALERTA_DRY_RUN=1: só mostra o que faria (para teste), sem escrever nada.
set -euo pipefail

gh_write() {
  if [ "${ALERTA_DRY_RUN:-}" = "1" ]; then echo "[simulação] gh $*" | cut -c1-160; else gh "$@"; fi
}

NOME="${1:?nome da rotina}"
RESULTADO="${2:?success ou failure}"
TITULO="Falha na rotina: ${NOME}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
AGORA="$(TZ=America/Sao_Paulo date '+%d/%m/%Y %H:%M') (Brasília)"
LABEL="alerta-rotina"

ABERTO="$(gh issue list --state open --label "$LABEL" --search "\"$TITULO\" in:title" --json number,title \
  --jq ".[] | select(.title == \"$TITULO\") | .number" | head -n1)"

if [ "$RESULTADO" = "failure" ]; then
  gh_write label create "$LABEL" --color B60205 --description "Rotina crítica com falha" >/dev/null 2>&1 || true
  CORPO="A rotina **${NOME}** falhou em ${AGORA}.

Execução: ${RUN_URL}

O que fazer: abrir a execução, ver a etapa que falhou e conferir se o site e o banco de produção estão respondendo (\`scripts/wjb-ai/producao/monitorar.sh\`). Este issue fecha sozinho quando a rotina voltar a funcionar."
  if [ -n "$ABERTO" ]; then
    gh_write issue comment "$ABERTO" --body "Falhou de novo em ${AGORA}. Execução: ${RUN_URL}"
    echo "Alerta: comentário no issue #${ABERTO}."
  else
    gh_write issue create --title "$TITULO" --label "$LABEL" --body "$CORPO"
    echo "Alerta: issue aberto."
  fi
elif [ -n "$ABERTO" ]; then
  gh_write issue comment "$ABERTO" --body "Voltou a funcionar em ${AGORA}. Execução: ${RUN_URL}"
  gh_write issue close "$ABERTO"
  echo "Alerta: issue #${ABERTO} fechado."
else
  echo "Sem alerta aberto."
fi
