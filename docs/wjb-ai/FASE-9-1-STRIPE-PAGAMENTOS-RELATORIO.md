# Fase 9.1 - Pagamentos com Stripe (modo de teste): relatório de implementação

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse` (a partir da Fase 9, commit `a8f8495a`) · **Só homologação.**

**Não foram feitos:** merge na `main`, deploy, acesso à produção (`wjb-website-app`), cobrança real, chave live, emissão fiscal, acesso a governo ou certificado.

Trabalho feito por um único agente, em sequência. Nenhum subagente paralelo foi usado.

> **Limite principal:** não há conta nem chaves de teste da Stripe neste ambiente (nenhuma variável `STRIPE_*`, sem SDK, sem CLI). Por isso:
> (a) o fluxo inteiro foi implementado e homologado com um **provedor simulado**, que passa pelo mesmo tratador de eventos da Stripe;
> (b) o **cliente da Stripe em modo de teste** está implementado e testado contra chamadas falsas (sem rede);
> (c) a rota do webhook foi testada com segredos que só têm o **formato** das chaves.
> **Nenhuma chamada foi feita à API da Stripe.** O primeiro teste real exige o checklist do doc 47.

## 1. Auditoria antes de implementar
| Item verificado | Situação encontrada |
| --- | --- |
| Migrations 0024-0032 | aplicadas só na homologação; 0030 tinha assinatura só `simulado`, sem nenhum campo de pagamento |
| Catálogo | 5 planos `approved` (0032), preços só no banco |
| Interruptores | `WJB_COMMERCIAL_ENABLED`, `WJB_COMMERCIAL_ENTITLEMENTS_ENFORCED`, todos lidos em runtime |
| Stripe no projeto | nenhum código, dependência ou variável |
| WhatsApp | CTAs usam só o oficial. **Achados:** rodapé e `/contato` exibiam um 2º número como WhatsApp; e **existe desde o início do projeto** `src/integrations/whatsapp-business` (aviso interno de lead pela Meta Cloud API), **inativo** sem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`. O doc 42 (Fase 9) afirmou que não havia módulo de API do WhatsApp; **isso estava errado** e foi corrigido (seção 8) |
| Produção | não consultada (incidente em aberto; sem evidência autorizada de recuperação) |

## 2. Produtos Stripe usados (conferidos nas fontes oficiais em 21/11/2026)
- **Checkout** (página hospedada da Stripe): `mode=subscription` para MEI Digital, Profissional e Empresa (com ou sem combo); `mode=setup` para a Nota Avulsa, que só cadastra o meio de pagamento e não cobra nada agora.
- **Billing**: assinatura mensal, faturas e renovação.
- **Customer Portal**: troca de cartão e histórico de cobranças.
- **Link**: **não há integração própria**. O checkout não fixa `payment_method_types`, então os meios exibidos vêm do Dashboard (Link aparece se a conta tiver e o comprador for elegível). A página de suporte da Stripe sobre meios aceitos no Brasil não menciona o Link: a disponibilidade tem de ser confirmada no Dashboard.
- **Pix**: a Stripe declara que Pix **não** suporta pagamento recorrente em contas brasileiras. Por isso não é usado em assinatura nem anunciado.
- **Connect**: não usado (a WJB é a única recebedora).

## 3. O que foi implementado
| Peça | Onde |
| --- | --- |
| Migration **0033** (aditiva): assinatura `simulado` ou `stripe_test` (**live não existe no banco**); novos status `pendente_pagamento`, `ativa_teste` e `inadimplente`; tabelas `payment_customers`, `payment_prices`, `payment_checkouts`, `payment_events` (uma linha por evento; `livemode` só `false`), `payment_invoices` (só BRL) e `payment_mock_objects`; `has_entitlement` aceita `ativa_teste` | `supabase/migrations/0033_wjb_payments_stripe_test.sql`; rollback `19_rollback_0033.sql` |
| Interruptores e chaves: `WJB_PAYMENTS_ENABLED`, `WJB_PAYMENTS_PROVIDER` (`mock` ou `stripe_test`). Confere só o formato das chaves e **recusa** `sk_live_`/`rk_live_`/`pk_live_`. `isLivePaymentsEnabled()` sempre `false` | `src/lib/payments/config.ts` |
| Contrato `PaymentProvider` e objetos normalizados | `src/lib/payments/types.ts` |
| Cliente Stripe pela API REST oficial, sem SDK novo: versão fixa `2024-06-20`, `Idempotency-Key`, recusa objeto `livemode`, nunca devolve corpo de erro bruto, preço por `lookup_key` com conferência do valor aprovado | `src/lib/payments/stripe-provider.ts` |
| Provedor simulado (mesmo contrato) e ações de teste: pagar, recusar, renovação paga ou com falha, estorno, contestação, cancelamento | `src/lib/payments/mock-provider.ts` |
| Assinatura do webhook: HMAC-SHA256 de `t.corpo_bruto`, comparação em tempo constante, janela de 300 s, aceita entradas extras | `src/lib/payments/signature.ts` |
| Serviço: início do checkout (preço e desconto relidos do catálogo **aprovado**; um cliente Stripe por empresa; preço por versão e por desconto; aceites gravados); tratamento de eventos **idempotente e independente da ordem** (sempre busca o estado atual no provedor antes de dar acesso); conciliação; Customer Portal; cancelamento no fim do período | `src/lib/payments/service.ts` |
| Regras puras: status da assinatura e da fatura (status desconhecido nunca dá acesso; cancelada é final), sessão paga, cobrança por nota só de evento **oficial** | `src/lib/payments/mapping.ts` |
| Rotas: webhook (só `stripe_test`, corpo bruto, limite de 512 KB, 500 só para a Stripe repetir) e conciliação (`CRON_SECRET`) | `src/app/api/payments/stripe/webhook`, `src/app/api/wjb-ai/cron/conciliar-pagamentos` |
| Portal `/portal/plano`: aviso "PAGAMENTO SIMULADO / AMBIENTE DE TESTE"; contratação leva ao checkout; pagamento pendente (com "desistir"); em atraso; período pago; faturas; forma de pagamento (Customer Portal); cancelamento no fim do período | `src/app/portal/plano/page.tsx` |
| Checkout simulado (só com provedor `mock`, só a empresa dona da sessão) | `src/app/portal/plano/checkout-simulado/[id]` |
| Admin `/admin/pagamentos`: configuração (só se as chaves existem e são de teste), conciliação, assinaturas, eventos sem dado pessoal, checkouts, faturas, eventos simulados (só super admin) | `src/app/admin/pagamentos` |
| Ações protegidas: só o responsável da empresa contrata, paga ou cancela; equipe só pelo Admin | `src/actions/payments.ts`, `src/lib/commercial/owner-context.ts` |

## 4. Fluxos de contratação
| Caminho | O que acontece |
| --- | --- |
| **Só emissão** (empresa sem contabilidade) | Checkout `subscription` pelo preço cheio do plano. O acesso vem quando a Stripe confirma (webhook ou conciliação) |
| **Contabilidade + emissão (combo)** | Mesmo fluxo, com preço Stripe próprio da variante com 20% (`wjb_<sku>_v<versão>_d2000`). O desconto vale só na mensalidade, nunca nas notas adicionais. A contabilidade é contrato à parte e **não** é afetada por falta de pagamento da emissão |
| **MEI Digital** | Plano de assinatura como os outros (R$ 24,90, ou R$ 19,92 no combo) |
| **Nota Avulsa** | Checkout `setup`: só cadastra o cartão. Nada é cobrado por pedido simulado, recusado ou duplicado. A cobrança de nota **oficialmente autorizada** está pronta como regra (`planUsageCharges`), mas não está ligada porque não existe nota oficial (Fase 10) |
| **Alto Volume** | Sem checkout: só proposta por WhatsApp e contato comercial |

Estados: pendente → ativa (teste) → em atraso / cancelada. Pagamento assíncrono (sessão completa com `unpaid`) espera a confirmação. A página de retorno **nunca** ativa nada sozinha.

## 5. Testes (números desta execução)
| Bateria | Resultado |
| --- | --- |
| Unitários (Vitest) | **592 passando** (17 novos: assinatura, chaves live, cliente REST com chamadas falsas, estados, cobrança por nota, inventário do WhatsApp) |
| TypeScript e lint | sem erros |
| Postgres 17 local (`run.sh`): T104-T119 (modo live recusado, pendente sem acesso, uma assinatura por empresa, inadimplente sem acesso, evento único, `livemode` recusado, só BRL, isolamento A/B, cliente não grava nem se reativa) e rollback de 0033 a 0024 | todos OK |
| API da homologação: comercial (14/14) e **pagamentos** P1-P12 (IDOR por id exato, cliente não lê ids da Stripe nem eventos, não forja evento, não altera fatura nem status, não cria checkout com preço próprio, nem o servidor grava live) | **12/12** |
| E2E com login real, regressão das Fases 2-9 (pagamentos desligados) | **40/40** |
| E2E de pagamentos com provedor simulado: combo com 20% calculado no servidor; cartão recusado não ativa; retorno sem confirmação não ativa; pagamento ativa e gera 1 fatura; o mesmo checkout não ativa duas vezes; empresa B não abre o checkout da A (404); renovação com falha → em atraso → renovação paga; estorno na fatura; cancelamento no fim do período e no provedor; desistência; Nota Avulsa sem cobrança e sem desconto; contador só lê; conciliação sem erro | **8/8** |
| E2E do webhook (`stripe_test`, segredo só de formato): sem assinatura, segredo errado, corpo alterado, requisição antiga e `livemode` → 400; evento válido não tratado → ignorado; repetido → "repetido" e uma única linha | **2/2** |
| Responsivo e acessibilidade das telas novas (checkout simulado, plano pendente, plano pago com faturas, Admin), 12 tamanhos de 320 a 1920 px, incluindo zoom de 200% (640 px) e celular deitado; axe em 390 e 1280 | **48 medições, 0 estouro, 0 falhas** (Chromium emulado; evidência em `docs/wjb-ai/evidencias/f91/`) |

**Corrigidos durante os testes:** o construtor do cliente Stripe validava com um segredo de exemplo mal formatado e recusava qualquer chave; o aviso de evento simulado sumia junto com o formulário quando a assinatura saía da lista (agora a ação redireciona com o resultado num aviso da página); a regra de "plano por nota" recebia a linha do banco no formato errado (achado pelo TypeScript).

**Não testado:** a API real da Stripe (sem conta), o Link e o 3-D Secure no checkout real, Safari, Firefox, aparelhos reais e leitor de tela.

## 6. Custos e margem (tabela pública da Stripe Brasil, 21/11/2026; sujeita a contrato)
Tarifas: cartão nacional **3,99% + R$ 0,39**; Billing **0,7%** do volume recorrente (não incide em fatura avulsa); contestação **R$ 55,00**; Pix 1,19% e boleto R$ 3,45 (fora das assinaturas).

| Cobrança | Valor | Cartão | Billing | Total | Líquido | Custo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MEI Digital | 24,90 | 1,38 | 0,17 | 1,56 | 23,34 | 6,3% |
| MEI Digital (combo) | 19,92 | 1,18 | 0,14 | 1,32 | 18,60 | 6,6% |
| Profissional | 69,90 | 3,18 | 0,49 | 3,67 | 66,23 | 5,2% |
| Profissional (combo) | 55,92 | 2,62 | 0,39 | 3,01 | 52,91 | 5,4% |
| Empresa | 149,90 | 6,37 | 1,05 | 7,42 | 142,48 | 5,0% |
| Empresa (combo) | 119,92 | 5,17 | 0,84 | 6,01 | 113,91 | 5,0% |
| 1 nota avulsa cobrada sozinha | 4,90 | 0,59 | - | 0,59 | 4,31 | **11,9%** |
| 5 notas avulsas numa só cobrança | 24,50 | 1,37 | - | 1,37 | 23,13 | 5,6% |
| Nota adicional na fatura do plano (MEI) | 3,90 | 0,16 | 0,03 | 0,18 | 3,72 | 4,7% |

A margem de contribuição final depende de custos que a WJB não informou (infraestrutura, suporte, impostos sobre o serviço, inadimplência). O Admin calcula a margem quando essas premissas forem preenchidas.

**Recomendações (não executadas, dependem da WJB):**
1. Cobrar a Nota Avulsa **agrupada uma vez por mês**, e não a cada nota: a tarifa fixa de R$ 0,39 sobre R$ 4,90 leva o custo a 11,9%.
2. Cobrar as notas adicionais dos planos **na fatura seguinte**, como item da assinatura (sem tarifa fixa extra).
3. Uma única contestação (R$ 55,00) consome mais de dois meses de MEI Digital: vale considerar regras de prevenção de fraude (Radar) e uma política clara de cancelamento.

## 7. Decisões pendentes
Ver o plano de ativação (doc 47): conta e chaves de teste, Link, política de inadimplência, cobrança agrupada, contratos, tributação e produção.

## 8. Inventário do WhatsApp
| Onde | Número | Situação |
| --- | --- | --- |
| Todos os CTAs comerciais, Dani, `/planos`, `/emissao-de-notas`, Portal | +55 11 97614-6375 (`wa.me`) | oficial, sem mudança |
| Rodapé e `/contato` (lista "WhatsApp") | 97614-6375 e **97685-4842** | **padronizado**: só o oficial é exibido (`publicWhatsApp` em `site.ts`). O segundo número **continua na configuração**, sem uso público, até a WJB decidir (reversível com uma linha) |
| JSON-LD (`telephone`), aviso de lead, Área do Cliente, `LeadForm` | oficial | sem mudança |
| `src/integrations/whatsapp-business` (aviso interno de novo lead pela Meta Cloud API) | oficial, como destino | **inativo** sem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`. Existe desde o início do projeto. **Não removido** (é código do site em produção); decisão pendente da WJB, porque contraria "não usamos a Cloud API" se as variáveis forem configuradas |

---

# Continuação: decisões da WJB após a Fase 9.1 (21/11/2026)

## A. Sandbox real da Stripe: pronto, **ainda não executado**
As chaves de teste ainda não estão no ambiente (nenhuma variável `STRIPE_*` em `.env.homolog.local` nem em `.env.stripe.local`). **Nenhuma chamada foi feita à API da Stripe.** O que ficou pronto para rodar assim que as chaves forem colocadas:

| Peça | Uso |
| --- | --- |
| `node scripts/wjb-ai/stripe/configurar-chaves.mjs` | lê cada chave da área de transferência do macOS (nada digitado nem exibido), recusa live, grava `.env.stripe.local` com permissão 600 (fora do Git) e limpa a área de transferência |
| `bash scripts/wjb-ai/stripe/sandbox.sh` | roda `src/tests/sandbox/stripe-sandbox.test.ts` contra a **API real da Stripe em modo de teste** e o Supabase de homologação, usando o código do próprio serviço. Recusa chave live. Grava evidência só com contagens e status em `docs/wjb-ai/evidencias/f91/sandbox-resultado.json` |

Roteiro do sandbox (11 passos, cartões de teste publicados pela Stripe, **Test Clocks** para o tempo):
1. Checkout real: modo assinatura, BRL, R$ 19,92 (20% do combo calculado no servidor), meios oferecidos (registra se o Link aparece). Desistir expira a sessão.
2. Pagamento aprovado (`pm_card_visa`): assinatura ativa, 1 fatura paga, direito de uso.
3. Eventos repetidos sem efeito. Evento real assinado com o `whsec_` passa pelo webhook como "repetido"; corpo alterado dá 400.
4. Renovação com Test Clock: 2ª fatura paga e período renovado.
5. Troca de plano com prévia proporcional e cobrança da diferença.
6. Renovação recusada (`pm_card_chargeCustomerFail`): em atraso, sem direito de uso. 7. Regularização com outro cartão: reativa.
8. Estorno registrado na fatura. 9. Conciliação sem erro.
10. Cancelamento no fim do período: segue ativo até a data; depois encerra.
11. Cartão recusado já na contratação: nada é ativado.

Limites assumidos: o checkout hospedado da Stripe **não** é preenchido por automação (a assinatura é criada pela API com cartão de teste, que equivale ao cliente concluir o checkout). Contestação real só pelo Dashboard. Sem URL pública de homologação, o sandbox lê os eventos pela API (`pullProviderEvents`, a mesma reserva usada na conciliação) em vez de recebê-los por webhook.

## B. Implementado nesta continuação
| Item | Onde |
| --- | --- |
| **Troca de plano pago**: o cliente vê **antes** o valor proporcional (`/v1/invoices/upcoming`), confirma, e a diferença é cobrada na hora (`always_invoice`, sem deixar assinatura incompleta). A assinatura local segue o **preço vigente na Stripe**, inclusive se a troca for feita pelo Customer Portal | `previewPaidPlanChange`, `changePaidPlan`, `planSnapshotForPrice` (service), `/portal/plano` |
| **Só os eventos necessários**: 8 (`checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`). Antes eram 14 | `HANDLED_EVENTS` |
| Busca de eventos no provedor como reserva (webhook perdido), dentro da conciliação | `pullProviderEvents` |
| E2E simulado da troca: prévia sem alterar nada, confirmação, Profissional com franquia 50 e desconto mantido | `staging-payments.spec.ts` |

## C. WhatsApp: auditoria do número secundário (11) 97685-4842
| Verificação | Resultado |
| --- | --- |
| Origem | documento de conteúdo institucional fornecido pela WJB em 30/08/2026 ("2 WhatsApp reais"); no código desde o primeiro commit (`2ba7c761`) |
| Função técnica | **nenhuma**: nenhuma integração, roteamento, notificação, JSON-LD ou formulário usa esse número; todos usam o principal |
| Onde aparecia | rodapé, `/contato` e o manual do cliente (`/ajuda`), sempre rotulado "WhatsApp" |
| Ação | comunicação **padronizada no principal** (+55 11 97614-6375) nesses três lugares. O contato **não foi apagado**: continua em `site.ts` com `publicWhatsApp: false` até a WJB confirmar a finalidade |

## D. Avisos de novos leads
- **Removido** `src/integrations/whatsapp-business` (Cloud API, nunca ligado) e as variáveis `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_LEAD_TEMPLATE_NAME`.
- O aviso de lead continua: **e-mail pelo Resend** para a caixa da WJB, com os dados e `replyTo` do lead, como antes. **Novo:** um **aviso interno no Admin** (`notifyNewLead`) para a equipe ativa (suspensos não recebem), só para lead gravado, com link para `/admin/leads` (exige login da equipe) e **sem nome, e-mail ou telefone no texto**. Sem e-mail duplicado.
- Testes: integração da rota (aviso só para lead gravado, sem dado pessoal) e unitário do aviso (destinatários, texto saneado, sem e-mail).

## E. Testes desta continuação
| Bateria | Resultado |
| --- | --- |
| Unitários | **598 passando** (21 da Fase 9.1, 1 do aviso de lead, +1 na integração de leads) |
| TypeScript e lint | sem erros |
| API da homologação | 56 / 14 / 12, 0 falhas |
| E2E com login real: Fases 2-9 / pagamentos simulados (com troca de plano) / webhook | **40/40, 9/9, 2/2** |
| Regressão com o build normal e tudo desligado | **96/96** |
| Sandbox real da Stripe | **não executado** (sem chaves); a suíte se pula sozinha e o script se recusa a rodar sem `.env.stripe.local` |
