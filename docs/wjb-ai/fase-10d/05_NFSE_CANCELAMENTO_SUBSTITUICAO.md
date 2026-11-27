# Fase 10D - NFS-e: cancelamento e substituição (preparação)

**Data:** 26/11/2026. **Situação:** fluxo de **preparação** implementado e testado; o **envio** continua bloqueado. Nenhuma regra fiscal foi inventada.

## 1. O que entrou (`src/lib/wjb-ai/fiscal/cancellation.ts`)
| Função | O que faz |
| --- | --- |
| `planCancellation` | confere a elegibilidade e monta o pedido `e101101` (Fase 10C) |
| `planSubstitution` | confere a elegibilidade e monta o grupo `subst` para a DPS substituta |
| `auditEntry` | linha da trilha de auditoria: **só códigos e o motivo da tabela oficial** |

**Elegibilidade** (todos os motivos de bloqueio são devolvidos juntos):

| Código | Quando |
| --- | --- |
| `EVENT_NOTE_SIMULATED` | nota simulada: não tem valor fiscal, não há o que cancelar ou substituir |
| `EVENT_NOTE_NOT_AUTHORIZED` | a nota não está autorizada |
| `EVENT_NO_ACCESS_KEY` | sem chave de acesso oficial |
| `EVENT_PRODUCTION_BLOCKED` | produção fiscal não autorizada |
| `EVENT_REASON_INVALID` / `SUBST_REASON_INVALID` | motivo fora da tabela oficial (cancelamento 1, 2 ou 9; substituição 01 a 05 ou 99) |
| `EVENT_INPUT_INVALID` / `SUBST_DESCRIPTION_LENGTH` | descrição fora de 15 a 255 caracteres, ou chave fora do padrão |

**Erros tratados:** a validação do XML vira bloqueio com código (sem exceção solta); outros erros continuam subindo.

**Auditoria:** a descrição livre do motivo **nunca** vai para a trilha, porque pode conter nome ou documento de pessoa. Rótulos novos em `audit-labels.ts`: `fiscal.cancellation_prepared`, `fiscal.cancellation_blocked`, `fiscal.substitution_prepared` e `fiscal.substitution_blocked`.

## 2. Testes (`wjb-ai-fase10d-eventos.test.ts`, 7 testes)
- pedido de nota autorizada: válido no `pedRegEvento` oficial (`xmllint`), com o Id do padrão do XSD;
- nota simulada, não autorizada, sem chave ou em produção: recusa com todos os motivos;
- motivo e descrição inválidos viram bloqueios;
- a trilha não contém a descrição nem documentos;
- substituição: grupo pronto com motivo oficial; recusa nos casos inválidos.

## 3. O que continua pendente (sem fonte pública lida)
| Pendência | Depende de |
| --- | --- |
| Envio do evento (caminho da API e JSON) | swagger autenticado (certificado novo) |
| Assinatura do pedido de evento | algoritmo confirmado |
| Prazo legal de cancelamento e regras municipais | Anexo I/manuais e o contador da WJB |
| Quais campos a DPS substituta pode mudar; se o `e105102` é enviado pelo emitente ou gerado pela SEFIN | swagger e Anexo I |
| Telas de cancelamento e substituição | primeira emissão oficial (uma nota simulada não tem o que cancelar) |
| Validação do contador (motivos aceitos, quem aprova, quando substituir em vez de cancelar) | responsável contábil da WJB |
