# 33 - Relatório da Fase 7 (homologação, sem emissão fiscal real)

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse`. Nada na `main`, nada na produção, nenhum acesso ao governo, nenhum certificado real, nenhum modelo de IA externo, nenhum serviço contratado. Omie/G-Click e o site público não foram alterados.

## 1. O que foi entregue

### Cliente (Portal)
| Item | Onde |
| --- | --- |
| Lista com filtros por situação (em linguagem do cliente), busca sem acento, paginação de 20, data do pedido | `/portal/nfse`, `fiscal/portal-list.ts` |
| **Correção:** lista e badges marcam "em simulação" sempre que não há tentativa oficial | `requests.repo.ts` (`simulated`) |
| Rascunho recuperável **sem dado pessoal** (serviço, valor, competência e referência na sessão da aba; documento, nome e e-mail do tomador nunca) | `nfse-request-form.tsx` |
| Prévia imprimível "SIMULAÇÃO - SEM VALOR FISCAL", documento mascarado, só a empresa dona | `/portal/nfse/[id]/previa` |
| Assistente por regras (sem IA): coleta passo a passo, confirma, cria pelo mesmo caminho validado do formulário; encaminha ao contador o que for código, alíquota, regime, cancelamento ou nota de produto | `/portal/nfse/assistente`, `conversation/engine.ts`, `actions/wjb-ai-conversation.ts` |
| Adaptador de canal: interno ativo; WhatsApp Business só contrato, recusa enviar | `conversation/channels.ts` |

### Contador e administrador
| Item | Onde |
| --- | --- |
| Atribuição, prioridade (urgente 4 h, alta 8 h, normal 24 h, baixa 72 h) e prazo calculado pelo banco ao entrar em revisão | migration **0029**, `review-queue.ts` |
| Fila ordenada por prazo; avisos "vence logo" e "prazo vencido"; filtros por empresa e "minhas" | `/admin/nfse` |
| Diferença entre versões de pedido corrigido (documento sempre mascarado) | `/admin/nfse/[id]` |
| Atribuir só com `fiscal.review` (servidor) e só para equipe ativa (banco); auditado (`fiscal.review_assigned`) | `actions/wjb-ai-admin.ts` |
| Mudança material na correção passa de novo pela política e, quando exigido, pela revisão | fluxo de correção existente (Fase 3) |

## 2. Testes

| Bateria | Resultado |
| --- | --- |
| Unitários | **546 passando** (15 novos da Fase 7: lista, prazo, diferença, máscara, motor de conversa, saneamento do estado, canais) |
| Postgres 17 local | 0024-0029, **T71-T76 novos**, rollback das seis migrations restaura o banco |
| API real da homologação | sem falhas (inclui 0029 aplicada) |
| **Carga** (`04-carga.mjs`, homologação) | ver seção 3 |
| E2E com login real | **24/24** (7 novos: assistente cria pedido, assistente encaminha alíquota, filtros/busca/prévia, prévia de outra empresa = 404, rascunho sem documento, contador atribui e prioriza, Atendimento não altera) |
| Regressão E2E do site | 92 passando, 0 falhas |
| Lint, tipos, build | ok; com o módulo desligado, `/portal/nfse`, `/assistente`, `/previa` e `/admin/nfse` respondem 404 |

## 3. Carga (homologação, plano Micro)
Cada pedido enviado **duas vezes ao mesmo tempo** pelo cliente (login real, RLS), depois numeração das DPS em paralelo pelo servidor.

| Pedidos | Chamadas | Criados | Duplicatas recusadas | Outros erros | p50 | p95 | Máx | Numeração | Números únicos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 20 | 10 | 10 | 0 | 273 ms | 294 ms | 321 ms | 290 ms | 10 |
| 30 | 60 | 30 | 30 | 0 | 702 ms | 723 ms | 755 ms | 629 ms | 30 |
| 100 | 200 | 100 | 100 | 0 | 956 ms | 1.024 ms | 1.025 ms | 1.974 ms | 100 |

Conclusão: a fila em tabela (sem custo novo) aguenta o volume previsto do piloto; a numeração serializa por série (por desenho) e fica em ~20 ms por DPS. Limpeza ao fim: nenhum pedido de carga restante.

## 4. Runbook de rollback (0029)
1. Desligar `WJB_AI_ENABLED` (tudo volta a 404).
2. Homologação: `scripts/wjb-ai/homologacao/11_rollback_0029.sql` (trigger, função, índice e 3 colunas; nenhuma tabela existente perde dado).
3. Código: reverter o commit da Fase 7 na branch; nenhuma rota pública depende dele.
4. Ordem completa de rollback: 0029 → 0028 → 0027 → 0026 → 0025 → 0024 (doc 23).

## 5. Pendências e riscos
- WhatsApp: depende de número oficial, Meta, opt-in e LGPD (contrato pronto, desligado).
- Anexos: fora do escopo da NFS-e de serviço; antimalware a definir quando houver anexo.
- Autônomo por CPF: continua bloqueado para revisão humana quando a regra do município for incerta (checklist da Fase 5).
- NF-e e NFC-e (mercadorias): não implementadas e não anunciadas.
- Conector oficial: depende de e-CNPJ novo e seguro e de autorização expressa (doc 31).

## 6. Proposta técnica da Fase 8 (contratação e assinaturas). Não iniciada.
**Objetivo:** vender e controlar o acesso ao produto sem cobrança real até a aprovação.

| Bloco | Proposta |
| --- | --- |
| Produtos | A) só emissão NFS-e; B) contabilidade completa + emissão como adicional; C) MEI Digital (sem obrigar contabilidade). NF-e/NFC-e fora das franquias, como oferta futura |
| Dados | tabelas `products`, `plans` (status `rascunho`/`publicado`), `subscriptions` (por empresa: plano, status `ativa`/`suspensa`/`cancelada`, período), `usage_counters` (notas por mês, franquia, excedente) |
| Acesso | `hasEntitlement(tenant, "nfse")` no servidor e na RLS; Portal mostra "contrate" em vez de 404 quando a empresa não tem o produto |
| Franquia | contagem no momento da **confirmação** do pedido (não no rascunho), idempotente pela chave do pedido; excedente informado antes de confirmar |
| Ciclo | upgrade/downgrade no próximo período; cancelamento mantém histórico e documentos; bloqueio por status sem apagar dados |
| Cobrança | só **modo rascunho**: nenhuma integração de pagamento até aprovação e escolha do provedor (proposta separada) |
| Comunicação | o emissor público é gratuito: a WJB cobra pela conveniência, automação e suporte; texto revisado antes de publicar |
| Onboarding | identificação do contribuinte, habilitação, consentimentos, procuração ao CNPJ da WJB (depende do e-CNPJ) |
| Testes | entitlement por empresa (A x B), franquia sob concorrência, troca de plano, cancelamento |

Estimativa: 1 migration aditiva, telas de planos no Admin (rascunho), gate de acesso no Portal e testes. Depende de aprovação do escopo comercial (preços e franquias são da WJB).
