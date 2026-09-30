/**
 * Roda uma vez quando o servidor Next sobe (antes de atender requisições).
 *
 * Fixa o fuso horário do processo em São Paulo (2026-09-30). O Node da
 * hospedagem roda em UTC, e o site calcula "hoje" no servidor: entre 21h e
 * meia-noite de Brasília, uma obrigação que vence hoje aparecia como
 * "Atrasada", e horários de mensagens, chamados e leads saíam 3 h
 * adiantados. O Node aplica a troca de `process.env.TZ` em tempo de
 * execução (Date e Intl passam a usar o fuso novo).
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = "America/Sao_Paulo";
  }
}
