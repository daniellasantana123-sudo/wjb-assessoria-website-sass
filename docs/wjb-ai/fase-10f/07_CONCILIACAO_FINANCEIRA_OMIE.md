# Fase 10F - Conciliação financeira com o Omie

## 1. Capacidades reais (verificadas no código em 27/11)
| Sistema | O que a plataforma faz hoje | Evidência |
| --- | --- | --- |
| **Omie.G-Click** | clientes, tarefas, obrigações, responsáveis e etapas (leitura e pré-tarefa) | `src/integrations/omie-gclick`, hosts `api.gclick.com.br` e `visao.gclick.com.br` |
| **Omie ERP (financeiro)** | **nada**: nenhuma chamada a contas a receber, boletos ou lançamentos | busca por `app.omie.com.br`, `ListarContasReceber`, `IncluirContaReceber`: nenhum resultado |
| Stripe | pagamentos da plataforma, só em modo de teste | doc 03 |

Ou seja: **hoje não há lançamento financeiro automático no Omie** e, portanto, nenhum risco de lançamento duplicado causado pela plataforma. O risco real é a mesma cobrança ser feita em dois lugares (Stripe e Omie ou outro meio).

## 2. Responsabilidade de cada sistema
| Sistema | Responsável por | Não faz |
| --- | --- | --- |
| **Stripe** | processar o pagamento do que é contratado **pela plataforma** | não decide acesso sozinho |
| **Plataforma WJB** | contratação, aceites, situação do serviço, **acesso** (só depois de confirmar no provedor), **origem de cobrança** de cada serviço | não lança nada no Omie |
| **Omie** | gestão financeira da WJB (honorários e o que já é cobrado fora da plataforma) | não é alterado pela plataforma |
| **G-Click** | tarefas e obrigações | sem dinheiro |

## 3. Mecanismos contra duplicidade (estado atual)
| Risco | Mecanismo | Onde |
| --- | --- | --- |
| **Cobrança duplicada** (mesmo serviço em duas origens) | **novo:** uma única origem ativa por empresa e serviço, garantida por índice único no banco; contratação pela Stripe recusada se o serviço estiver registrado como cobrado pelo Omie ou outro meio | migration **0038**, `billing-source.ts`, `startCheckout` |
| Duas assinaturas da mesma empresa | uma assinatura não cancelada por empresa | `startCheckout` + índice da 0030 |
| Dois cliques no pagamento | chave de idempotência por contratação na Stripe | `checkout:<id>` |
| Dois reembolsos pelo mesmo clique | chave por cobrança + saldo + valor | doc 03 |
| Cliente duplicado na Stripe | um cliente por empresa (chave primária) | `payment_customers` |
| Cliente duplicado no G-Click | busca pelo CNPJ antes de criar; sem confirmação, não cria | `findClientByDocument` (2026-09-30) |
| Liberação indevida do serviço | acesso só depois de buscar o estado atual no provedor; página de retorno e conteúdo do evento nunca bastam | `handlePaymentEvent` |
| Evento repetido ou fora de ordem | idempotência por id do evento; tratador independente da ordem | `payment_events` |
| Divergência entre pagamento e registro | conciliação periódica com o provedor | `reconcilePayments` |
| Lançamento financeiro duplicado no Omie | **não se aplica hoje** (a plataforma não lança nada no Omie) | seção 1 |

## 4. Como a origem de cobrança funciona (novo)
- **Admin → Pagamentos → Origem de cobrança**: o super admin (MFA recente) registra que um serviço da empresa já é cobrado pelo **Omie** ou por **outro meio**. Serviços: plano de emissão de notas, honorários contábeis, serviço avulso pelo código do catálogo.
- A Stripe é registrada **sozinha** quando o pagamento é confirmado no provedor, e encerrada quando a assinatura é cancelada.
- Para trocar de origem: **parar a cobrança no outro sistema**, encerrar a origem (digitar ENCERRAR) e só então contratar pela plataforma.
- Histórico: origem encerrada não volta a ficar ativa nem muda de sistema (gatilho no banco).
- Cliente vê só as origens da própria empresa; ninguém escreve pelo navegador.

**Testado:**
- banco (Postgres descartável e CI): 13 verificações, de T260 a T272;
- unitário: 5/5;
- homologação (E2E): registrar a origem "outro meio" faz a contratação ser recusada com a explicação e sem checkout aberto; a segunda origem ativa é recusada; encerrar libera.

**Aplicado:** só na homologação (`uisoyodnzdyaaxisujmk`), com backup antes. **Não aplicado na produção.**

## 5. Recomendações antes de cobrar honorários pela Stripe
1. Decisão da WJB: os honorários continuam no Omie (recomendado no início) ou passam para a Stripe, cliente a cliente.
2. Para cada cliente que for para a Stripe: encerrar no Omie, registrar a troca na plataforma e conferir a primeira fatura.
3. Se a WJB quiser o recebimento da Stripe **lançado no Omie** (conciliação automática), isso exige:
   - a documentação da API financeira do Omie ERP;
   - credenciais próprias, que hoje não existem no projeto;
   - autorização expressa.

   Proposta: um lançamento por fatura paga, com a chave `stripe:<id da fatura>` gravada no Omie para nunca lançar duas vezes. **Não implementado:** depende de credencial, documentação e autorização.
4. Preços de honorários e serviços adicionais continuam **aguardando aprovação** (doc 09).
