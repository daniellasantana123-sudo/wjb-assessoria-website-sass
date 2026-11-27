# Fase 10F - Integração Stripe (modo de teste)

**Situação:** a conta Stripe da WJB existe, mas **nenhuma chave foi configurada neste ambiente**. Por isso tudo desta fase foi validado com o provedor **simulado** (mesmo tratador de eventos) e com chamadas à API da Stripe usando um *fetch* falso. Os **11 cenários do Sandbox real** estão prontos e rodam assim que a WJB gravar as chaves de teste (seção 3). Nenhuma chave foi pedida pelo chat; nenhuma cobrança real é possível (chave live recusada no código e no banco).

## 1. O que existe e como foi testado
| Item | Situação | Teste |
| --- | --- | --- |
| Checkout (assinatura, cadastro de cartão, pagamento avulso) | pronto (9.1 / 10E) | simulado + unitário; Sandbox pronto |
| Billing (assinatura, renovação, troca de plano proporcional, cancelamento) | pronto (9.1) | simulado; Sandbox pronto (Test Clocks) |
| Customer Portal | pronto (9.1, `openBillingPortal`) | Sandbox |
| Webhooks (10 eventos, assinatura HMAC, 300 s, idempotência por id) | pronto | `staging-payments-webhook` 2/2 |
| Clientes: **um por empresa** | pronto (`payment_customers.tenant_id` é chave primária) | simulado |
| Produtos e preços: só do catálogo **aprovado**, versionados | pronto (Fase 9) | simulado |
| **Reembolso (novo)** | **implementado nesta fase** | unitário 8/8, homologação (E2E), Sandbox preparado |
| **Origem única de cobrança (novo)** | **implementado nesta fase** (migration 0038) | banco 13/13, unitário 5/5, homologação (E2E) |
| Histórico e conciliação | pronto (`payment_invoices`, `payment_events`, `reconcilePayments`) | simulado |
| Acesso só depois da confirmação no provedor | pronto | simulado; Sandbox |

## 2. Reembolso (novo)
- **Onde:** Admin → Pagamentos → Faturas → "Reembolsar (teste)". Só super admin com **MFA recente**, digitando REEMBOLSAR.
- **Regra** (`src/lib/payments/refunds.ts`), sempre com os dados **buscados de novo no provedor**, nunca do formulário:
  - só cobrança paga e sem contestação;
  - cartão e Pix: sim, total ou parcial até o saldo;
  - **boleto: não** (a Stripe não reembolsa boleto; a devolução é por transferência, fora da plataforma);
  - meio desconhecido: tratamento manual;
  - nenhum prazo é presumido: se a Stripe recusar (ex.: prazo do Pix), o erro aparece.
- **Idempotência:** a chave inclui cobrança, saldo já reembolsado e valor. Dois cliques no mesmo estado = **um** reembolso.
- **Mensagens honestas** (achado da revisão de segurança): recusa explícita da Stripe = "nada foi devolvido"; rede, tempo esgotado ou conflito = **"situação incerta, confira na Stripe"**. Erro depois de a devolução acontecer é registrado como reembolso feito (a sincronização vem depois pelo evento `charge.refunded` ou pela conciliação).
- **Empresa:** sai da fatura no banco e é reconferida no provedor (`tenantByCustomer`); a cobrança tem de pertencer à fatura.
- **Auditoria:** `payments.refund_requested` / `refund_blocked` / `refund_failed`, só com valor, situação, motivo e códigos.
- **Limite conhecido:** se um reembolso falhar depois na Stripe (`failed`), a nova tentativa no mesmo estado reaproveita a mesma chave por 24 h.

## 3. Guia para o responsável da conta Stripe (configurar as chaves de TESTE)
1. No Dashboard da Stripe, ligar o **modo de teste** (ou abrir o *Sandbox*).
2. **Developers → API keys**: copiar com o **botão de copiar** (não selecionando o texto, que pode vir cortado) a chave **secreta de teste** (`sk_test_…`) ou criar uma **chave restrita de teste** (`rk_test_…`, recomendado). Permissões mínimas sugeridas: Customers, Checkout Sessions, Prices e Products (escrita); Subscriptions, Invoices, Charges, Refunds (escrita); Events (leitura); Billing Portal (escrita); Test Clocks (escrita, só para o Sandbox).
3. A chave **publicável de teste** (`pk_test_…`).
4. **Developers → Webhooks**: criar o destino `https://<endereço de homologação>/api/payments/stripe/webhook` com **exatamente** os 10 eventos de `HANDLED_EVENTS` (`src/lib/payments/types.ts`) e copiar o segredo `whsec_…`.
5. No computador de desenvolvimento: `node scripts/wjb-ai/stripe/configurar-chaves.mjs`. O script lê **cada chave da área de transferência**, recusa chave live, grava `.env.stripe.local` (fora do Git, permissão 600) e limpa a área de transferência. **Nada é digitado, exibido ou enviado pelo chat.**
6. Rodar `bash scripts/wjb-ai/stripe/sandbox.sh`: 11 cenários reais (Checkout, cartão 4242, evento repetido, renovação com Test Clock, troca de plano, cartão recusado, **reembolso pelo nosso serviço com pedido duplo**, conciliação, cancelamento).

**Nunca:** colocar chaves da Stripe no painel da Hostinger enquanto as prévias estiverem ligadas (a prévia usa o mesmo `.env`), nem chave live em qualquer lugar.

## 4. Métodos de pagamento (conforme elegibilidade da conta)
| Método | Situação | Depende de |
| --- | --- | --- |
| Cartão de crédito | pronto | Sandbox |
| Apple Pay / Google Pay | sem código extra (Checkout hospedado) | ligar no Dashboard; Sandbox |
| Pix | entra pelos métodos dinâmicos do Checkout | ligar no Dashboard; Sandbox |
| Boleto | pronto, vencimento por `WJB_PAYMENTS_BOLETO_EXPIRES_DAYS` (desligado) | decisão da WJB (sem reembolso nem contestação) |
| Pix Automático | pronto, teto por `WJB_PAYMENTS_PIX_AUTOMATICO_MAX_CENTS` (desligado) | **confirmar com a Stripe se a conta tem acesso** (pode exigir convite); não ligar sem isso |
| Stripe Link | **não usado** | indisponível para empresa no Brasil |

## 5. O que ainda não foi verificado
- Nenhuma chamada real à Stripe foi feita nesta fase (sem chaves). Os nomes de parâmetros seguem a documentação pública e precisam do Sandbox.
- Customer Portal: a configuração do portal (o que o cliente pode trocar ou cancelar) é feita no Dashboard da Stripe e não foi conferida.
