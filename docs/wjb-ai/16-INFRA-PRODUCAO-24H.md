# 16 - Plano de infraestrutura para operação 24 horas

**Status:** plano. Nada foi contratado.

| Item | Hoje | Necessário para produção fiscal |
| --- | --- | --- |
| Banco | Supabase plano gratuito (pausa por inatividade; ocorreu em 29/09 e 10/11) | plano pago, sem pausa, com backups diários e PITR (recuperação a um ponto no tempo) |
| Homologação | Postgres 17 local em Docker com camada mínima do Supabase (`scripts/wjb-ai/homologacao/`) | segundo projeto Supabase só para homologação, com dados fictícios |
| Fila e worker | inexistentes | tabela de jobs no Postgres + worker agendado; worker dedicado quando o volume exigir |
| Agendamento | GitHub Actions (lembretes) | agendamento com execução a cada minuto para a fila fiscal |
| Rate limit | em memória | persistente (no Postgres ou serviço dedicado) |
| Monitoramento | logs da Hostinger | alertas de falha de envio, fila parada, certificado a vencer, custo de IA |
| Segredos | painel da Hostinger | cofre (ver 15) para certificados; painel continua para chaves de API |
| Backup testado | restauração validada só na homologação | rotina mensal de restauração em projeto separado |

Ordem sugerida: plano pago do Supabase -> projeto de homologação no Supabase -> fila/worker -> cofre -> conector oficial em produção restrita.
