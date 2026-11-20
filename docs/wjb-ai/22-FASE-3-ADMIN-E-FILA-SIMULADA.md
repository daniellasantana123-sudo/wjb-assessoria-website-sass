# 22 - Fase 3: Admin fiscal, revisão e fila simulada

**Status:** implementada e testada **só na homologação** (`wjb-ai-homologacao`) e no staging local. Branch `wjb-ai/f2-solicitar-nfse`; nada na `main`, nada aplicado em produção, conector sempre SIMULADO.

## Telas (todas 404 com `WJB_AI_ENABLED` desligado)
| Rota | Quem | O que faz |
| --- | --- | --- |
| `/admin/nfse` | equipe | indicadores (em revisão, na fila, fila de erros, envios simulados, pedido parado há mais tempo) e filas: Em revisão, Prontas, Na fila, Fila de erros, Concluídas, Todas |
| `/admin/nfse/[id]` | equipe; decisões só contador/super admin | dados completos, motivos da política, decisão de revisão (aprovar, pedir correção, bloquear - motivo obrigatório nos dois últimos), autorizar envio simulado, devolver da fila de erros, histórico com autor de cada passo ("Processamento automático" ou nome), tentativas com selo SIMULADO |
| `/admin/nfse/perfis` | contador/super admin criam; aprovação só com `fiscal_profile.approve` | rascunho de perfil (limite por nota sem revisão, IBGE opcional), aprovação com justificativa, registro de autorização de emissão (só referência da evidência; nunca arquivo, certificado ou senha) |
| `/admin/nfse/permissoes` | super admin concede/revoga; equipe vê | concessões ativas e revogadas, com motivo, quem e quando |
| Portal `/portal/nfse/[id]` | cliente | autorização do conector simulado aparece como **"Autorizada em simulação"** + aviso "esta nota não foi emitida e não tem valor fiscal" |
Link "NFS-e (simulação)" na barra lateral do Admin só com o módulo ligado (ainda não no menu do celular).

## Fluxo
```text
Cliente confirma prévia -> política -> REVISAO_HUMANA ou CONFIRMADA
Contador: revisão -> CONFIRMADA (confirmação original mantida) | DADOS_PENDENTES | BLOQUEADA
Contador: "Autorizar envio" (exige perfil aprovado + autorização válida + modo mock) -> AUTORIZADA_PARA_ENVIO
Rota agendada POST /api/wjb-ai/cron/processar-fila (Bearer CRON_SECRET):
  ENFILEIRADA -> ENVIANDO -> consulta pela chave ANTES de enviar -> envio simulado
  -> AUTORIZADA | REJEITADA | RESULTADO_INDETERMINADO -> CONCILIACAO_OFICIAL -> consulta -> resultado
  falha/timeout: nunca REJEITADA; nova tentativa em 1, 2, 4, 8, 16 min; na 5ª, fila de erros (intervenção humana)
```
- Cada passo só acontece se o pedido ainda estiver no estado esperado (atualização condicional): dois processadores não enviam duas vezes.
- Tentativa já AUTORIZADA registrada: conclui sem reenviar.
- Desligar `WJB_AI_ENABLED` para a fila na hora (a rota responde 404).
- Regra **só de simulação** para exercitar caminhos: centavos 13 = indeterminado depois autorizado; 66 = rejeitada.

## Migration 0025 (aditiva)
`attempt_count`, `next_attempt_at`, `last_error`, `needs_intervention` em `fiscal_requests`; `actor_kind` (user/system) em `fiscal_request_events`; índice da fila. Rollback: `scripts/wjb-ai/homologacao/04_rollback_0025.sql`. Aplicada na homologação com backup antes; validada também no Postgres local com rollback.

## Auditoria
Novas ações no `audit_log` (com rótulo em /admin/logs): solicitação revisada, envio autorizado (simulado), devolvida à fila, rascunho de perfil criado, autorização registrada; além das já existentes de concessão/revogação/aprovação.

## Preparação dos 6 agentes (sem IA)
`src/lib/wjb-ai/agents/contracts.ts`: os 6 agentes do doc 14 com lista fechada de ferramentas e efeito declarado (`read`, `draft`, `human_task`, `audit`). Nenhuma ferramenta transmite nota nem devolve dado pessoal ao modelo; Validação, Cadastro, Supervisão e Auditoria não usam IA; `assertToolAllowed` é a barreira obrigatória. Nenhum provedor de IA é chamado.

## Testes
- Unitários: fila (8 cenários: kill switch, normal, rejeição, indeterminado conciliado com 1 envio, falha nunca vira rejeição, limite -> fila de erros, já autorizada sem reenvio, concorrência), revisão (4), agentes (4).
- Homologação real: 35/35 pela API; **13/13 E2E com login real** (5 F2 + 8 F3: concessão pelo super admin, contador sem concessão barrado, aprovação com justificativa, registro de autorização, limite manda para revisão, atendimento sem botão de decisão, revisão + autorização de envio, fila processando indeterminado e rejeição, cron com segredo errado = 401, cliente vendo "Autorizada em simulação").
- Regressão: 401 unitários, 92 E2E, lint, tipos e build.
