# 20 - Análise de impacto: produção de NANO para MICRO

**Status:** análise. **Não executar** sem autorização específica. **Pré-requisito novo:** resolver primeiro o incidente do documento 19 - redimensionar um banco que não sobe pode piorar a recuperação.

| Item | Análise |
| --- | --- |
| O que muda | memória de até 0,5 GB para 1 GB (compute compartilhado nos dois) |
| Custo | o painel marca "Free Upgrade": mesmo preço por hora (US$ 0,01344), coberto pelo Pro; custo projetado segue US$ 25. Confirmar no aviso do próprio painel antes de aplicar |
| Interrupção | o Postgres reinicia; o Supabase indica alguns minutos. Durante esse tempo: Portal/Admin/leads indisponíveis; site comercial no ar com fallback do WhatsApp |
| Janela | fora do horário comercial (seg a sex, 9h-18h), ex.: 21h ou fim de semana |
| Backup antes | **obrigatório**: hoje não existe nenhum backup. Esperar o primeiro backup diário do Pro aparecer **e** fazer um `pg_dump` manual (exige a senha do banco, só pelo proprietário) |
| Verificação depois | status Healthy; login com a conta da CEO; abrir Portal e Admin; enviar um lead de teste e apagar; conferir lembretes; `POST /api/wjb-ai/...` continua 404 |
| Plano de recuperação | se não voltar em ~15 min: chamado ao suporte com o horário exato da mudança; o redimensionamento pode ser revertido para NANO pelo mesmo painel; em último caso, restaurar o backup do dia |
| Benefício | mais folga de memória para operação 24 h e para as conexões dos novos módulos |

Recomendação: autorizar só depois de (1) incidente resolvido, (2) primeiro backup confirmado, (3) janela combinada.
