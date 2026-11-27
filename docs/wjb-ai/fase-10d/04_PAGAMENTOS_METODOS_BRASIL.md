# Fase 10D - Pagamentos: métodos para empresa brasileira e alternativas ao Link

**Data da pesquisa:** 26/11/2026, só na documentação pública da Stripe (fontes no fim). **Nada foi cobrado nem configurado.** O Sandbox real continua aguardando as chaves de teste (doc 08 da Fase 10C).

## 1. Link: confirmado indisponível
A tabela de países não lista o Brasil como local de empresa do Link, e a nota da Stripe diz que o Payment Element não aceita o Link no Brasil. **Confirmado.**

## 2. O que uma conta Stripe brasileira aceita em assinatura (BRL)
| Método | Empresa no Brasil | Assinatura | Observações |
| --- | --- | --- | --- |
| **Cartão de crédito** (Visa, Mastercard) | sim | sim | renovação mais confiável. O dinheiro de cartão nacional fica disponível em **30 dias**. **American Express não** está disponível para conta brasileira; Elo e Hipercard **não confirmados** |
| **Apple Pay / Google Pay** | sim | sim | o substituto natural do "checkout rápido" do Link; no Checkout hospedado funciona sem configuração extra |
| **Pix Automático** | sim, mas a tabela geral marca o Pix para BR como "**Invite only**" (as páginas da Stripe se contradizem) | sim | o cliente autoriza no banco um valor **máximo** e a periodicidade; cada cobrança sai 3 dias depois do aviso do banco (fica "processing"); cobrança acima do limite falha (atenção à troca de plano); uma cobrança por ciclo |
| **Boleto** | sim (só BR) | sim (`charge_automatically`: um boleto por e-mail a cada ciclo) | R$ 5,00 a R$ 49.999,99; vence em 3 dias por padrão (0 a 60); confirmação em até 1 dia útil. **Não tem reembolso nem contestação** |
| Cartão de débito | não confirmado | não confirmado | — |
| Débito automático bancário | não há opção brasileira na documentação | — | o Pix Automático faz esse papel |
| Parcelamento | não há parcelamento brasileiro documentado | não funciona em assinatura | — |

## 3. Recomendação
1. **Cartão de crédito + Apple Pay/Google Pay** como padrão. Não exigem nenhuma mudança de código: o Checkout já usa os métodos ligados no Dashboard.
2. **Pix Automático**, com o limite de autorização acima do plano mais caro, para a troca de plano não falhar. Antes, **confirmar com a Stripe se a conta precisa de convite**.
3. **Boleto** como alternativa, com tolerância de inadimplência no Billing.

Os itens 2 e 3 dependem de decisão comercial da WJB: prazo de recebimento, ausência de reembolso no boleto e convite do Pix.

## 4. O que mudou no código nesta fase
Pix e boleto são **assíncronos**. O Checkout termina "complete" com pagamento "unpaid", e a confirmação chega depois.
- O tratamento já era seguro: Checkout com pagamento pendente **não libera acesso**, porque a liberação depende do estado atual buscado no provedor.
- Faltavam os dois eventos de confirmação tardia na lista do webhook. **Adicionados:** `checkout.session.async_payment_succeeded` e `checkout.session.async_payment_failed`. Agora são 10 eventos, e o doc 47 foi atualizado para o cadastro do webhook. O tratador já busca o estado de novo no provedor para qualquer `checkout.session.*`, então não há caminho novo de liberação.
- Teste atualizado (`wjb-fase91-payments.test.ts`, lista exata de eventos).

## 5. Cenários para o Sandbox real (quando houver chaves de teste)
Além dos 11 cenários existentes:
- boleto: gerado, pago (simulação de pagamento no modo teste) → acesso liberado; vencido sem pagamento → sem acesso;
- Pix Automático: autorização → cobrança após 3 dias → ativo; cobrança acima do limite → falha tratada;
- Apple Pay/Google Pay: Checkout concluído.

## Fontes
- https://docs.stripe.com/payments/payment-methods/payment-method-support
- https://docs.stripe.com/payments/link
- https://docs.stripe.com/payments/pix
- https://docs.stripe.com/payments/pix/pix-automatico
- https://docs.stripe.com/billing/subscriptions/pix?api-integration=checkout
- https://docs.stripe.com/payments/boleto
- https://docs.stripe.com/payments/boleto/set-up-subscription
- https://docs.stripe.com/payments/cards/supported-card-brands
- https://docs.stripe.com/apple-pay?platform=web
- https://docs.stripe.com/payments/installments
- https://support.stripe.com/questions/payout-schedule-and-payment-availability-for-accounts-in-brazil
