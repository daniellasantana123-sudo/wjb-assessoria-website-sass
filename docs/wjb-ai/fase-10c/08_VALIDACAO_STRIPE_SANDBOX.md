# Fase 10C - Stripe Sandbox e Link

**Data:** 26/11/2026. **Situação:** a integração está pronta e testada com o provedor **simulado**. O Sandbox real **não foi executado**, porque não há chaves de teste neste computador (`.env.stripe.local` ausente). Nenhuma chamada à Stripe foi feita e nenhuma chave foi pedida pelo chat.

## 1. Itens pedidos pela fase
| Item | Situação | Onde |
| --- | --- | --- |
| Stripe Checkout | pronto; **simulado** testado (staging, pagamentos 9/9); real aguarda chaves | `src/lib/payments/stripe-provider.ts`, cenário 1 do sandbox |
| **Link by Stripe** | **não disponível para a WJB** (ver seção 2); nada a habilitar no código | comentário em `stripe-provider.ts` |
| Assinaturas recorrentes | pronto; simulado testado | cenário 2 |
| Renovação | pronto; Test Clock no sandbox real | cenário 4 |
| Webhooks | pronto; 8 eventos tratados | `HANDLED_EVENTS` |
| Assinatura do webhook | HMAC-SHA256 de `t.corpo`, janela de 300 s, comparação em tempo constante; testado | staging webhook 2/2 |
| Idempotência | por id de evento e `Idempotency-Key` nas chamadas | cenário 3 |
| Cancelamento | no fim do período; cancelada é final | cenário 10 |
| Falhas de pagamento | cartão recusado na contratação e na renovação | cenários 6 e 11 |
| Histórico financeiro | faturas, estorno e conciliação | cenários 8 e 9 |
| Isolamento entre clientes | a empresa B não abre o checkout da A; RLS testada | staging + `07-seguranca-pagamentos.mjs` |
| Sandbox x produção | `sk_live_`, `rk_live_` e `pk_live_` são recusadas no código; o banco recusa live (`mode in ('simulado','stripe_test')`, `livemode = false`) | migration 0033 |

## 2. Link by Stripe
Na documentação oficial (26/11/2026):
- a tabela de países do Link **não lista o Brasil** entre os locais de empresa suportados;
- a página do Link diz: "No Brasil e na Tailândia, o Payment Element não aceita o Link".

Fontes:
- https://docs.stripe.com/payments/payment-methods/payment-method-support
- https://docs.stripe.com/payments/link

**Conclusão:** para uma conta Stripe da WJB, sediada no Brasil, o Link não está disponível. O que **não está confirmado** é se o Checkout hospedado aceita o Link para uma conta brasileira, mas a tabela de países indica que não.

O código já usa métodos de pagamento definidos no Dashboard (sem `payment_method_types`). Se a Stripe liberar o Link para o Brasil, basta ligá-lo no Dashboard: o código não muda, e o teste entra no sandbox.

## 3. Passos para rodar o Sandbox real (pela pessoa autorizada)
1. Criar ou abrir a conta Stripe da WJB em **modo de teste**.
2. No computador autorizado, copiar a chave secreta **de teste** e rodar `node scripts/wjb-ai/stripe/configurar-chaves.mjs`:
   - o script lê a chave da área de transferência;
   - recusa chaves live;
   - grava `.env.stripe.local` com permissão 600, arquivo ignorado pelo Git.

   Repetir com o segredo do webhook de teste. **Nunca colar chave no chat.**
3. Rodar `bash scripts/wjb-ai/stripe/sandbox.sh`. Ele cobre:
   - os 11 cenários (Checkout, aprovação, evento repetido, renovação com Test Clock, troca de plano proporcional, renovação recusada e regularização, estorno e conciliação, cancelamento, cartão recusado);
   - a limpeza no fim.
4. Para o webhook vindo da Stripe, precisa de uma URL pública de homologação. Até lá, o webhook é testado com eventos assinados localmente.

## 4. O que nunca acontece nesta fase
- cobrança real;
- chave live;
- conta ativada para receber;
- mudança no banco de produção.

O próprio banco recusa registrar uma assinatura live.
