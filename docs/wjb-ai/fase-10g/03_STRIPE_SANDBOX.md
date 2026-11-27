# Fase 10G - Stripe Sandbox

**Situação:** **BLOQUEADO POR DEPENDÊNCIA EXTERNA.** Em 27/11 não havia nenhuma chave da Stripe configurada: nem `.env.stripe.local` neste ambiente, nem variável `STRIPE_*` no servidor (conferido só pelos nomes). Por isso **nenhum cenário real foi executado** nesta fase. Nenhuma chave foi pedida pelo chat.

## 1. Onde configurar as chaves de teste (para o responsável autorizado)
| Onde | Para quê | Como |
| --- | --- | --- |
| **Computador de desenvolvimento** (recomendado agora) | rodar o Sandbox real (`sandbox.sh`) contra o Supabase de homologação | `node scripts/wjb-ai/stripe/configurar-chaves.mjs`: lê cada chave da área de transferência e grava `.env.stripe.local` (fora do Git, permissão 600) |
| Servidor de homologação dedicado (futuro) | testar o Checkout pelo navegador num endereço de homologação | variáveis no painel desse servidor, nunca no da produção |
| **Servidor de produção (Hostinger)** | **não configurar agora** | os pagamentos estão desligados na produção; chave de teste ali não tem uso e amplia a exposição |

Variáveis (nomes exatos, valores de **teste**):
- `STRIPE_SECRET_KEY`: `sk_test_…` ou, de preferência, chave **restrita** `rk_test_…` (permissões no doc 03 da 10F);
- `STRIPE_PUBLISHABLE_KEY`: `pk_test_…`;
- `STRIPE_WEBHOOK_SECRET`: `whsec_…` do destino de webhook de teste, com os 10 eventos de `HANDLED_EVENTS`.

Copiar sempre pelo **botão de copiar** do Dashboard (o texto selecionado pode vir cortado; já aconteceu com a chave do Supabase em 23/09). Chave live é recusada pelo script, pelo código e pelo banco.

## 2. Cenários prontos (os 11 da Fase 9.1/10F mais 2 novos), e como cada pedido do PO é coberto
| Pedido do PO | Cenário do Sandbox | Situação |
| --- | --- | --- |
| Pagamento aprovado | 2 (cartão 4242) | pronto |
| Pagamento recusado | 6 (renovação recusada) e 11 (recusado na contratação) | pronto |
| Pagamento pendente | 11 (assinatura incompleta = pendente, sem acesso) | pronto |
| Pagamento expirado | 1 (desistir expira a sessão) | pronto |
| Assinatura recorrente | 4 (renovação com Test Clock) | pronto |
| Cancelamento de assinatura | 10 | pronto |
| Reembolso | 8 (pelo nosso serviço, pedido duplo = 1 devolução, outra empresa recusada) | pronto |
| Webhook duplicado | 3 | pronto |
| Webhook com assinatura inválida | 3 (corpo alterado) e **13 (novo: assinatura velha e de outro segredo)** | pronto |
| Confirmação assíncrona | eventos `async_payment_*` tratados; teste real depende de Pix ou boleto ligados na conta | **depende do Dashboard** |
| Tentativa de cobrança duplicada | **12 (novo: segundo checkout recusado; serviço com origem externa não abre checkout)** | pronto |
| Customer Portal | sessão do portal | pronto no código; configuração do portal no Dashboard não conferida |

## 3. Métodos de pagamento
| Método | O que falta |
| --- | --- |
| Cartão | só as chaves |
| Apple Pay / Google Pay | ligar no Dashboard; o Checkout hospedado oferece sozinho (domínio verificado no caso da Apple) |
| Pix | ligar no Dashboard (modo de teste) |
| Boleto | ligar no Dashboard e decidir (sem reembolso nem contestação) |
| Pix Automático | **confirmar com a Stripe se a conta tem acesso**; não ligar sem isso |
| Stripe Link | não usado (indisponível para empresa no Brasil) |

## 4. Ao receber as chaves
`bash scripts/wjb-ai/stripe/sandbox.sh`. A evidência é gravada em `docs/wjb-ai/evidencias/f91/sandbox-resultado.json`, só com contagens e situações, sem ids nem chaves. Nenhuma cobrança real é possível.
