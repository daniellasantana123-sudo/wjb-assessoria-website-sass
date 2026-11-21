# 35 - Fase 8: planos, assinaturas e contratação (PRD em rascunho)

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse` · **Só homologação.** Nenhum preço foi aprovado pela WJB, nenhum preço aparece no site público e nenhuma cobrança real existe.

## 1. Objetivo
Permitir que uma empresa contrate a **emissão de notas de serviço (NFS-e)** de duas formas:
- **sozinha** ("somente emissão"), sem ser cliente de contabilidade;
- **em combo**, somada à contabilidade da WJB, com desconto.

Tudo em modo simulado: assinatura, consumo e fatura.

## 2. Catálogo em rascunho (hipótese do documento da Fase 8, NÃO aprovada)
| SKU | Plano | Mensalidade | Franquia | Nota extra |
| --- | --- | --- | --- | --- |
| `nfse_avulsa` | Nota avulsa | R$ 0,00 | — | R$ 4,90 por nota |
| `nfse_mei` | MEI Digital | R$ 24,90 | 10 | R$ 3,90 |
| `nfse_profissional` | Profissional | R$ 69,90 | 50 | R$ 2,50 |
| `nfse_empresa` | Empresa | R$ 149,90 | 150 | R$ 1,50 |
| `nfse_volume` | Alto Volume | sob proposta | sob proposta | sob proposta |

- **Desconto do combo:** 20% (rascunho) para quem já é cliente de contabilidade. Vale **só sobre a mensalidade da emissão**, nunca sobre o excedente. Limitado a 50% no código (`comboDiscountBp`).
- No banco, plano só pode estar em `draft` ou `archived`. O valor `approved` é recusado por CHECK (teste T78). Para ativar um preço de verdade é preciso uma migration nova, depois da aprovação formal.
- Toda mudança de preço gera uma versão nova e entra no histórico (`commercial_plan_changes`, T79). Plano não se apaga: arquiva-se (T80).
- Os valores foram gravados por `scripts/wjb-ai/homologacao-supabase/05-comercial-rascunho.mjs`, **só na homologação**.

## 3. Regras de negócio implementadas
| Regra | Onde |
| --- | --- |
| Só o **responsável** da empresa contrata, troca de plano ou cancela | `src/actions/commercial.ts` |
| O preço vem do **servidor** (catálogo), nunca do navegador | `contractPlanAction` |
| Contratar exige os **4 aceites**: termos da emissão, privacidade, preços e franquia, representação fiscal. Cada aceite guarda a versão (`2026-11-21-rascunho`), a data e o usuário, e não pode ser alterado depois | `ACCEPTANCE_DOCUMENTS`, `commercial_acceptances` (append-only) |
| Só **uma assinatura aberta** por empresa | índice único (T84) |
| Assinatura só existe no modo `simulado` | CHECK `mode = 'simulado'` (T83) |
| Ciclo mensal pelo calendário (dia 1 até dia 1 do mês seguinte, com virada de ano) | `cycleFor` |
| Avisos ao chegar em **80%** e **100%** da franquia | `usageSummary` |
| Nota além da franquia **só com autorização** e dentro do **limite de gasto** definido pelo cliente. Sem autorização, o pedido é recusado com explicação | `canConsume`; `entitlementBlock` em `src/actions/wjb-ai-fiscal.ts` |
| Nota avulsa cobra por nota, sem precisar autorizar excedente. "Alto volume" encaminha ao comercial | `canConsume` (`sob_proposta`) |
| Troca de plano vale no **próximo ciclo** | `schedulePlanChangeAction` |
| Cancelamento mantém o histórico (consumo e aceites) | `cancelSubscriptionAction` |
| Assinatura suspensa ou cancelada perde o direito **na hora** | `has_entitlement` (T89) |
| Nota **simulada nunca é faturável** e nunca consome crédito pago. Regra garantida pelo banco, não pela tela | CHECK `kind <> 'simulada' or billable = false` (T86) |
| O mesmo pedido não consome duas vezes | `unique(request_id, kind)` (T87) |
| A prévia de fatura é sempre marcada como simulação | `invoicePreview` (`simulated: true`) |
| Margem só aparece depois que a WJB informar as premissas de custo. Sem elas, nenhum número é mostrado | `marginAt`, `/admin/comercial` |

## 4. Interruptores (lidos no servidor em tempo de execução)
| Variável | Efeito | Padrão |
| --- | --- | --- |
| `WJB_COMMERCIAL_ENABLED` | liga `/portal/plano`, `/admin/comercial`, `/emissao-de-notas` e a seção da emissão em `/planos` | desligado (404) |
| `WJB_COMMERCIAL_ENTITLEMENTS_ENFORCED` | bloqueia o pedido de NFS-e sem plano ativo ou com o excedente acima do limite | desligado |
| `isRealBillingEnabled()` | cobrança real | **sempre `false`** (não há variável que a ligue) |

## 5. Telas
- **Portal `/portal/plano`**: aviso de rascunho, planos com o preço já com desconto quando houver combo, contratação com os aceites, plano ativo com barra de uso, avisos, prévia de fatura, excedente, troca, cancelamento e aceites registrados.
- **Admin `/admin/comercial`**: catálogo (o super admin edita; o contador só lê), desconto do combo, premissas de custo com tabela de margem, relação de cada empresa (contabilidade ou somente emissão), assinaturas com suspender e reativar.
- **Site `/emissao-de-notas`**: página para captar interesse (lista de espera). Não mostra preço. Telefone opcional, consentimento LGPD obrigatório.

## 6. Pendências de aprovação (dependem da WJB)
1. Preços, franquias e valor da nota extra.
2. Percentual do desconto do combo.
3. Texto final dos 4 documentos de aceite, com revisão jurídica.
4. Premissas de custo para calcular a margem.
5. Escolha do meio de pagamento, só numa fase futura e com autorização própria.
6. Decidir se a página `/emissao-de-notas` vai ao ar e quando.
