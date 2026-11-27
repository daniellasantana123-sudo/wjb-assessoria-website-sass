# Fase 10E - Pagamentos: situação por item e coexistência com o Omie

**Data:** 26/11/2026. **Tudo em modo de teste ou simulado.** Nenhuma cobrança real, nenhuma chave pedida pelo chat. O Sandbox real da Stripe continua aguardando as chaves de teste.

## 1. Métodos (sem depender do Link)
| Método | Situação no código | O que falta |
| --- | --- | --- |
| Cartão de crédito | pronto (métodos dinâmicos do Dashboard); testado com o provedor simulado | Sandbox real |
| Apple Pay / Google Pay | prontos: o Checkout hospedado oferece sem código extra | ligar no Dashboard; Sandbox |
| **Pix Automático** (assinatura) | **novo**: mandato com valor máximo mensal, configurável (`WJB_PAYMENTS_PIX_AUTOMATICO_MAX_CENTS`) | confirmar com a Stripe se a conta precisa de convite; Sandbox |
| Pix (pagamento único) | o modo de pagamento único existe; Pix entra pelos métodos dinâmicos | Sandbox |
| **Boleto** | **novo**: vencimento configurável (`WJB_PAYMENTS_BOLETO_EXPIRES_DAYS`, 0 a 60) | decisão da WJB (sem reembolso nem contestação); Sandbox |

Os nomes dos parâmetros seguem a documentação pública da Stripe. **Precisam ser conferidos no Sandbox antes de ligar.**

## 2. Itens pedidos
| Item | Situação |
| --- | --- |
| Pagamentos avulsos | **novo**: Checkout `mode=payment` no provedor, com preço do catálogo; sem preço, não há Checkout |
| Assinaturas recorrentes | pronto (Fase 9.1) |
| Honorários contábeis mensais | **depende de decisão**: os preços da contabilidade não estão no catálogo. Hoje só os planos de emissão de notas e o combo foram aprovados (Fase 9). Ver seção 3 (Omie) |
| Serviços adicionais | **sem catálogo**: os preços não foram aprovados pela WJB, então não criei produtos nem tela (seria inventar valor) |
| Pagamentos pendentes | Checkout concluído com pagamento pendente (boleto ou Pix) **não libera** acesso |
| Confirmação assíncrona | eventos `async_payment_succeeded`/`failed` tratados (Fase 10D) |
| Webhooks autenticados | HMAC-SHA256 com janela de 300 s e comparação em tempo constante |
| Idempotência | por id de evento no banco e `Idempotency-Key` em toda chamada |
| Reconciliação | rotina de conciliação com o estado na Stripe (Fase 9.1) |
| Histórico | faturas e eventos gravados (`payment_invoices`, `payment_events`) |
| Falhas e cancelamentos | cobertos pelos cenários do Sandbox e pelo provedor simulado |
| Acesso só após confirmação | o estado é sempre buscado no provedor; a página de retorno não libera nada |
| Sem cobrança duplicada | Checkout por pedido com chave de idempotência; uma assinatura ativa por empresa |

**Testes desta fase:** `wjb-fase10e-pagamentos.test.ts` (7 testes). Staging da homologação com o provedor simulado: resultado na matriz (doc 07).

## 3. Coexistência com o Omie (cobrança duplicada)
**O que a integração faz hoje:** a integração existente é com o **Omie.G-Click**: clientes, tarefas e obrigações. Ela **não cria nada financeiro**, nem contas a receber, nem boletos, nem lançamentos. Por isso, pagamentos pela Stripe e a integração atual **não se duplicam entre si**.

**Onde está o risco real:** se a WJB já cobra os honorários contábeis **fora da plataforma** (Omie ERP, boleto do banco ou outro meio), ligar a cobrança da contabilidade pela Stripe para o mesmo cliente **cobraria duas vezes**.

**Recomendação, antes de ligar qualquer cobrança de honorários:**
1. Regra de negócio: **uma única fonte de cobrança por cliente e por serviço**.
2. Na plataforma, cobrar pela Stripe só o que **não** é cobrado em outro lugar. Hoje isso é só a emissão de notas. O combo com a contabilidade exige que a contabilidade saia do outro meio de cobrança daquele cliente.
3. Se a Stripe passar a cobrar honorários: lançar o recebimento no Omie (conciliação) **ou** desligar a cobrança no Omie para aquele cliente. As duas coisas ao mesmo tempo não podem ficar ligadas.
4. Não automatizar lançamento financeiro no Omie sem a documentação da API financeira dele e sem autorização.

**Decisões da WJB:** como os honorários são cobrados hoje, e se a Stripe vai substituir esse meio, só complementar, ou ficar só na emissão de notas.
