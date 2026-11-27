# 47 - Fase 9.1: plano de ativação dos pagamentos (teste e, depois, real)

**Nada aqui foi executado.** Cada passo depende de autorização. Nenhuma chave, senha ou segredo deve ser enviado por chat, e-mail ou Git.

## A. Primeiro teste com a Stripe de verdade (modo de teste, homologação)
Feito pelo responsável da WJB no Dashboard da Stripe (`dashboard.stripe.com`), em **modo de teste** (a chave "Modo de teste" fica ligada):
1. Criar ou entrar na conta empresarial da WJB (titularidade em nome da empresa, sem conta pessoal). Não é preciso ativar a conta para o modo de teste.
2. **Configurações > Meios de pagamento:** deixar Cartões ligado; ver se **Link** aparece disponível para a conta e ligá-lo (se não aparecer, o checkout funciona só com cartão). **Não** ligar Pix para assinaturas.
3. **Configurações > Billing > Customer portal:** permitir atualizar a forma de pagamento e ver o histórico. Cancelamento: "no fim do período". Troca de plano: deixar desligada por enquanto.
4. **Desenvolvedores > Chaves de API:** criar uma **chave restrita** de teste (`rk_test_...`) com escrita em Checkout Sessions, Customers, Payment Methods, Prices, Products, Billing Portal Sessions, Subscriptions, Invoices (pagar fatura no teste de regularização), Refunds (teste de estorno) e Test Clocks, e leitura em Charges e Events. A chave secreta padrão de teste (`sk_test_`) também funciona, mas a restrita limita o estrago se vazar.
5. **Desenvolvedores > Webhooks:** adicionar o destino `https://<url-de-homologação>/api/payments/stripe/webhook` (exige uma URL pública de homologação, que ainda não existe; a alternativa é a Stripe CLI com `stripe listen`, instalada pelo responsável), com **só estes 10 eventos** (os 2 de pagamento assíncrono entraram na Fase 10D, para Pix e boleto): `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` e `charge.dispute.created`. Versão da API do destino: `2024-06-20` (a mesma do código).
6. Colocar as chaves **direto no ambiente de homologação**, nunca no chat: rodar `node scripts/wjb-ai/stripe/configurar-chaves.mjs` e copiar cada chave no Dashboard quando o script pedir. Ele lê a área de transferência, recusa live e grava `.env.stripe.local` (permissão 600, fora do Git). Variáveis:
   - `STRIPE_SECRET_KEY` = a chave restrita de teste;
   - `STRIPE_PUBLISHABLE_KEY` = `pk_test_...`;
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`;
   - `WJB_PAYMENTS_ENABLED=true` e `WJB_PAYMENTS_PROVIDER=stripe_test`.
7. Conferir em `/admin/pagamentos`: "Chaves de teste da Stripe: presentes e de teste".
8. Rodar `bash scripts/wjb-ai/stripe/sandbox.sh` (os 11 passos automáticos com Test Clocks; resultado em `docs/wjb-ai/evidencias/f91/sandbox-resultado.json`). Depois, o roteiro manual no navegador: contratar MEI Digital com o cartão de teste `4242 4242 4242 4242`; ver o cartão recusado `4000 0000 0000 0002` e o 3-D Secure `4000 0025 0000 3155` (cartões publicados pela Stripe); simular falha de renovação com o "test clock" da Stripe; estornar e contestar pelo Dashboard; conferir a fatura no Portal e o evento em `/admin/pagamentos`.

## B. Antes de qualquer cobrança real (live)
Todos estes itens são decisões da WJB, separadas entre si:
| # | Decisão | Por quê |
| --- | --- | --- |
| 1 | Ativar a conta Stripe (dados da empresa, conta bancária para repasse, verificação) | exigência da Stripe para receber |
| 2 | Termos do serviço, política de privacidade da emissão, autorização de representação fiscal e política de cancelamento e reembolso, com revisão jurídica | os aceites atuais são minuta |
| 3 | Tributação do serviço da WJB (NFS-e da própria WJB sobre a assinatura) | obrigação fiscal da WJB |
| 4 | Regra de inadimplência: hoje "em atraso" bloqueia novos pedidos de nota na hora. Avaliar uma tolerância (por exemplo, enquanto a Stripe tenta de novo) | experiência do cliente |
| 5 | Cobrança agrupada mensal da Nota Avulsa e das notas adicionais na fatura (relatório, seção 6) | custo de 11,9% por nota avulsa cobrada sozinha |
| 6 | Emissão fiscal oficial liberada (Fase 10): só uma nota oficialmente autorizada pode gerar cobrança por nota | não cobrar por nota inexistente |
| 7 | Produção estável e migrations 0024-0033 aplicadas com backup | o projeto de produção estava em incidente |

## C. Mudanças de código necessárias para o modo live (ainda não feitas, de propósito)
O código **recusa** live em três camadas: a configuração, o CHECK do banco (`mode`, `livemode`) e `isLivePaymentsEnabled() === false`. Para o modo real será preciso, com autorização expressa:
1. Uma migration que aceite `stripe_live` e `livemode = true`.
2. Um modo `stripe_live` na configuração, com chave `rk_live_` só no cofre de produção.
3. Uma URL de webhook de produção com segredo próprio.
4. Ligar o envio das cobranças por nota oficial.
5. Os testes de regressão de todo este documento.
