# Fase 10G - Estratégia financeira e Omie

## 1. Proposta adotada pelo Product Owner
| Regra | Como o sistema garante |
| --- | --- |
| Honorários dos **clientes atuais** continuam na origem atual (Omie ou outro meio) | nenhuma migração automática; nenhum código lança, altera ou lê o financeiro do Omie |
| Stripe para **novos serviços** contratados pelo site e pelo SaaS | contratação pela plataforma só com preço **aprovado** no catálogo do banco |
| Stripe para **novas assinaturas** depois da aprovação comercial | planos só ficam contratáveis com status `approved` (0032) |
| Omie e G-Click preservados | integração G-Click intacta (só clientes, tarefas e obrigações) |
| **Uma única origem de cobrança por empresa e serviço** | migration 0038: índice único parcial no banco + recusa no `startCheckout` |

## 2. Validação da 0038 e das proteções contra duplicidade
| Teste | Onde | Resultado |
| --- | --- | --- |
| T260 a T272: segunda origem ativa recusada, serviço e empresa independentes, lista fechada, origem não muda por update, encerrada não volta, cliente só lê a própria empresa, ninguém escreve pelo navegador, anônimo não lê | Postgres descartável e CI (`banco`) | 13/13 |
| Regra `canChargeWithStripe` | unitário | 5/5 |
| Registrar origem externa → contratação recusada sem abrir checkout → encerrar libera | homologação (E2E com login real e MFA) | aprovado |
| Execução interrompida deixando origem ativa → contratação seguinte recusada | homologação (achado real da 10F) | comportamento correto; teste ajustado |
| Segundo checkout com contratação pendente; serviço com origem externa | Sandbox Stripe (cenário 12, novo) | **pronto, aguarda chaves de teste** |

## 3. Como aplicar a estratégia na operação
1. **Clientes atuais:** a equipe registra em Admin → Pagamentos → Origem de cobrança os serviços que já são cobrados pelo Omie, começando pelos honorários. Assim, nenhum deles pode ser contratado de novo pela plataforma por engano.
2. **Novos serviços pelo site:** só depois de o preço estar aprovado no catálogo. A Stripe é registrada como origem quando o pagamento é confirmado.
3. **Cliente atual que quiser migrar para a Stripe:** encerrar no Omie, encerrar a origem na plataforma e só então contratar. Nunca automático.
4. **Homologação:** nenhum lançamento financeiro no Omie (não existe código para isso).

## 4. Pendências
- Aprovação dos preços dos novos serviços (abertura, alterações, regularizações, certidões, fiscais, consultorias, adicionais).
- Decisão sobre registrar no Omie os recebimentos da Stripe (exige documentação e credencial da API financeira do Omie, além de autorização).
