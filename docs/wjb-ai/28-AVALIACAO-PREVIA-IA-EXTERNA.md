# 28 - Avaliação exigida antes de integrar um modelo externo de IA

**Status:** nenhum modelo externo está integrado. `DisabledLlmProvider` é o padrão e lança erro se chamado. Este documento é o roteiro que precisa estar preenchido e aprovado pela WJB **antes** de qualquer integração.

## O que a IA faria (e o que nunca fará)
- **Faria:** interpretar a mensagem do cliente (texto livre do Portal ou do WhatsApp) e devolver um JSON de rascunho; responder dúvidas gerais.
- **Nunca fará:** escolher código de serviço, alíquota, retenção, regime, IBS/CBS ou série; aprovar; transmitir; ler outra empresa. A validação continua sendo o motor determinístico (`parseNfseDraft`, `evaluatePolicy`, `evaluateFiscalReadiness`).

Hoje o mesmo trabalho é feito por regras fixas (`ruleBasedExtract`) e o fluxo dos seis agentes roda inteiro sem IA (`runSimulationFlow`).

## Itens a apresentar antes da integração

| # | Item | Conteúdo mínimo |
| --- | --- | --- |
| 1 | Finalidade e base legal (LGPD art. 7º) | execução de contrato com o cliente da WJB; registro no ROPA |
| 2 | Dados enviados ao provedor | só o texto da mensagem; CPF/CNPJ e e-mail mascarados antes do envio quando possível; nenhum certificado, nenhuma senha |
| 3 | Contrato (DPA) | retenção zero ou mínima, proibição de uso para treino, subprocessadores listados, notificação de incidente |
| 4 | Transferência internacional (LGPD art. 33) | região de processamento e cláusulas padrão da ANPD |
| 5 | Custos | preço por token, volume estimado por mês, teto de gasto configurado no provedor |
| 6 | Controles de segurança | chave do provedor no cofre, chamadas só pelo servidor, limite por empresa, registro sem dado pessoal (já garantido por `runTool`) |
| 7 | Avaliações | conjunto de mensagens fictícias com resultado esperado; taxa de extração correta; zero caso de parâmetro fiscal inventado |
| 8 | Plano de saída | voltar para `DisabledLlmProvider` sem perda de funcionalidade (é o comportamento atual) |
| 9 | Aprovação | assinatura da WJB e registro em `docs/wjb-ai/12-PENDENCIAS-E-DECISOES.md` |

Até esses itens serem aprovados, **nenhum dado real de cliente** passa por modelo externo.
