# Fase 10H - Stripe Sandbox

**Situação: NÃO CONCLUÍDO. Bloqueado por dependência externa.** Em 27/11 (verificado de novo nesta fase, só pelos nomes) não há chave da Stripe neste ambiente (`.env.stripe.local` ausente) nem no servidor (0 variáveis `STRIPE_*`). **Nenhum cenário real foi executado.** Os 13 cenários estão prontos e rodam com um comando assim que as chaves forem gravadas.

## 1. Passo a passo para o responsável autorizado (cerca de 15 minutos)
**No Dashboard da Stripe** (dashboard.stripe.com), com a conta da WJB:
1. Ligar o **modo de teste** (botão "Test mode" ou "Sandbox" no topo). Tudo abaixo é feito nesse modo.
2. **Developers → API keys → Create restricted key** (recomendado no lugar da chave secreta completa). Nome: `wjb-sandbox`. Permissões (os nomes podem variar um pouco na interface) de escrita: Customers, Checkout Sessions, Products, Prices, Subscriptions, Invoices, Refunds, Billing Portal, Test Clocks; leitura: Charges, Events. Criar.
3. Na mesma página, localizar a **Publishable key** (`pk_test_…`).
4. **Developers → Webhooks → Add destination**: endereço `https://<homologação>/api/payments/stripe/webhook`. Se ainda não houver endereço público de homologação, use o Stripe CLI no computador de desenvolvimento (`stripe login` e depois `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`): ele mostra um segredo de teste `whsec_…`, que serve para o Sandbox local (o script de chaves exige esse segredo). No destino do Dashboard, escolher **exatamente** os 10 eventos de `HANDLED_EVENTS` e copiar o **Signing secret** (`whsec_…`).
5. **Settings → Payment methods** (modo de teste): ligar Cartão, Pix, Boleto, Apple Pay e Google Pay; ver se aparece **Pix Automático** (se não aparecer, a conta pode precisar de convite da Stripe).

**No computador de desenvolvimento** (nunca pelo chat):
6. `node scripts/wjb-ai/stripe/configurar-chaves.mjs`. O script pede uma chave por vez: **copie com o botão de copiar do Dashboard** e tecle Enter. Ele lê da área de transferência, recusa chave live, grava `.env.stripe.local` (permissão 600, fora do Git) e limpa a área de transferência.
7. `bash scripts/wjb-ai/stripe/sandbox.sh`.

**Não** colocar as chaves no painel da Hostinger: os pagamentos estão desligados na produção, e o `.env` de lá também servia às prévias.

## 2. O que será validado (pedido do PO → cenário)
| Validação | Cenário |
| --- | --- |
| Checkout, pagamento aprovado | 1 e 2 |
| Pagamento recusado | 6 e 11 |
| Pendente | 11 (assinatura incompleta, sem acesso) |
| Expirado | 1 |
| Billing: assinatura e renovação | 4 (Test Clock) |
| Customer Portal | sessão do portal (configuração no Dashboard a conferir) |
| Webhooks: duplicado, corpo alterado, assinatura velha ou de outro segredo | 3 e 13 |
| Reembolso (pelo nosso serviço) e conciliação | 8 e 9 |
| Troca de plano | 5 |
| Cancelamento | 10 |
| Idempotência e cobrança duplicada | 3 e 12 |
| Métodos | cartão nos cenários; Pix e boleto dependem do passo 5; Apple Pay e Google Pay só aparecem no Checkout hospedado em navegador compatível (teste manual) |

A evidência é gravada em `docs/wjb-ai/evidencias/f91/sandbox-resultado.json`, só com contagens e situações.

## 3. O que já está validado sem a Stripe real
Homologação com o provedor simulado (`staging-payments`, 11 testes, incluindo reembolso e origem de cobrança); webhook com assinatura (2 testes); unitários da regra de reembolso, da origem de cobrança e da chamada à API com *fetch* falso. Isso **não substitui** o Sandbox real.
