# Fase 10E - Plano de publicação das Fases 10C, 10D e 10E

**Nada disto foi executado.** Tudo depende do resultado da auditoria do banco de produção e de autorização específica do Product Owner.

## 1. Branches e compatibilidade
| Branch | Base | Conteúdo |
| --- | --- | --- |
| `feature/wjb-fase-10c` (PR #1, rascunho) | `main` antiga (`a7d15d22`) + Fases 1 a 10C | módulo fiscal, comercial, pagamentos, segurança, ciclo de vida do certificado |
| `feature/wjb-fase-10d` | 10C | cofre, cancelamento e substituição, eventos assíncronos, portabilidade, CI |
| `feature/wjb-fase-10e` | 10D | formulários (WebKit), pagamento avulso, Pix Automático e boleto, CI ampliada, monitoramento |

A fusão da 10C com a `main` atual (já com o hotfix) foi testada com `git merge-tree`: **sem conflito**. A 10D e a 10E são sequenciais sobre a 10C.

**Recomendação:**
- publicar a **10E inteira**, que contém 10C e 10D, num único PR, **depois** de desligar as prévias da Hostinger;
- **ou** separar a correção dos formulários (doc 03) num hotfix próprio, se a WJB quiser só ela antes. Ela não depende de migration nem do módulo fiscal.

## 2. Ordem das migrations na produção (só após o Portão 0)
O banco de produção deve estar em 0023. Cada lote começa com backup **testado**.

| Lote | Migrations | Efeito | Rollback |
| --- | --- | --- | --- |
| 1 | 0024 a 0029 | núcleo fiscal, fila, versões, numeração da DPS, trilha do certificado, revisão (só tabelas novas) | scripts `03` a `11` de rollback, em ordem inversa |
| 2 | 0030 a 0033 | comercial e pagamentos (tabelas novas; live recusado no banco) | `13` a `19` |
| 3 | 0034 a 0035 | limite compartilhado e MFA exigido no banco | `21` e `23` |
| 4 | 0036 a 0037 | ciclo de vida do certificado (lista de bloqueio **permanente**) | `27` e `25`. Atenção: na produção, exportar a lista antes |

Todas foram testadas em sequência e revertidas no Postgres local e na CI (`banco`). Na homologação, foram aplicadas com backup antes de cada uma. **Nenhuma altera tabela existente.**

## 3. Chaves de liga/desliga (estado esperado depois do merge)
| Chave | Produção hoje | Depois do merge |
| --- | --- | --- |
| `WJB_AI_ENABLED`, `WJB_COMMERCIAL_ENABLED`, `WJB_PAYMENTS_ENABLED` | ausentes | **continuam ausentes** até decisão |
| `WJB_AI_OFFICIAL_TRANSMISSION_ENABLED`, `WJB_AI_SEFIN_READ_AUTHORIZED` | ausentes | ausentes (governo bloqueado) |
| `WJB_PAYMENTS_PIX_AUTOMATICO_MAX_CENTS`, `WJB_PAYMENTS_BOLETO_EXPIRES_DAYS` | ausentes | ausentes |
| `SAAS_PUBLIC_ENABLED`, `GCLICK_REAL_INTEGRATION_ENABLED` | `true` | sem mudança |

No código, `isFiscalProductionAllowed()` e `isRealBillingEnabled()` são sempre falsos.

## 4. Checklist de deploy
- [ ] Portão 0: auditoria do banco analisada (`analisar-auditoria.mjs`), caminho decidido, backup ou PITR ativo e testado.
- [ ] Prévias da Hostinger desligadas (ou risco aceito por escrito).
- [ ] Proteção da `main` aplicada (doc 05).
- [ ] CI verde no PR.
- [ ] Autorização específica do merge.
- [ ] Merge e acompanhamento do build no servidor (`hbuilds/logs`, versão ativa).
- [ ] **Antes** de ligar qualquer chave: migrations em lotes (seção 2), cada uma com backup testado.

## 5. Checklist pós-deploy
- [ ] `bash scripts/wjb-ai/producao/monitorar.sh --servidor` sem falhas. Ler os cabeçalhos **mais de uma vez**: logo depois da troca de versão, uma leitura isolada pode enganar.
- [ ] Formulário de contato: o HTML com `method="post"` aparece (o monitor avisa enquanto não estiver publicado); um envio de teste combinado com a WJB.
- [ ] Login do Portal e do Admin com MFA (pessoa da WJB).
- [ ] Rotina de lembretes do dia seguinte com `ok: true` no GitHub Actions.
- [ ] `stderr.log` vazio e erros só de processo ocioso.

## 6. Rollback e contingência
- **Código:** `git revert` do merge + push; a Hostinger recompila a versão anterior. Nunca voltar para uma versão do Next.js anterior à 16.4.6.
- **Migrations:** só se uma chave tiver sido ligada e der problema. Primeiro **desligar a chave** (efeito imediato, sem redeploy); reverter migration só com backup e autorização.
- **Banco:** recuperação sempre num projeto separado (doc 01).
- **Contingência de contato:** se o formulário falhar, ele já mostra WhatsApp e e-mail; o assistente Dani encaminha para o WhatsApp mesmo com a API fora do ar.
