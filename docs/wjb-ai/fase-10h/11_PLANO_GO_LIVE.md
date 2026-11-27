# Fase 10H - Plano consolidado de publicação das Fases 10C a 10H

**Nada disto foi executado em produção.** Merge integral, migrations e ligação de módulos dependem da auditoria do banco e de aprovação expressa.

## 1. Mapa das branches
| Branch | Base | Situação |
| --- | --- | --- |
| `main` (`e2576a38`) | - | Next.js 16.4.6, hotfixes de privacidade e de domínio, alertas, CI |
| `feature/wjb-fase-10c` → `10d` → `10e` → `10f` → `10g` → **`10h`** | sequenciais | módulos WJB AI (fiscal, comercial, pagamentos, certificado, cofre, origem de cobrança) |
| **`feature/wjb-fase-10h`** | 10G + merge da `main` atual | **candidato único**: contém tudo, entra na `main` **sem conflito** (`git merge-tree`) |
| `hotfix/*` | `main` | já publicados (exceto `hotfix/alertas-rotinas`, substituída pela `-v2`) |

**Dependências:** cada fase depende da anterior (código e migrations). Não há como publicar a 10F sem a 10C. Por isso o candidato é a 10H inteira, com os módulos **desligados**.

## 2. Ordem de integração
1. **Portão 0**, auditoria do banco: CSV analisado, caminho A a D decidido, backup ou PITR confirmado e restauração testada em projeto separado.
2. Prévias desligadas no hPanel e proteção da `main` aplicada (doc 05).
3. PR da `feature/wjb-fase-10h` para a `main` (seguro só depois do item 2), com a CI verde: o job `banco` passa a rodar de verdade.
4. Merge, com o deploy automático: **código novo no ar com todas as chaves `WJB_*` desligadas** (nenhuma tabela nova é usada).
5. Validação pós-deploy (seção 6).
6. Migrations em lotes (seção 3), uma janela por lote.
7. Ligação de módulos (seção 4), uma chave por vez, com aprovação.

## 3. Ordem das migrations (produção hoje em 0023)
| Lote | Migrations | Rollback | Observação |
| --- | --- | --- | --- |
| 1 | 0024 a 0029 (núcleo fiscal) | `03` a `11` | só tabelas novas |
| 2 | 0030 a 0033 (comercial e pagamentos) | `13` a `19` | live recusado no banco |
| 3 | 0034 a 0035 (limite e MFA no banco) | `21`, `23` | a 0035 exige MFA no banco: **conferir antes que a conta da CEO tem MFA** |
| 4 | 0036 a 0037 (ciclo de vida do certificado) | `27`, `25` | lista de bloqueio permanente: exportar antes de qualquer rollback |
| 5 | **0038** (origem única de cobrança) | `29` | só tabela nova |

Antes de cada lote: backup com restauração **testada**. Todas foram aplicadas em sequência e revertidas no Postgres descartável (`run.sh`, job `banco` da CI) e aplicadas na homologação. **Nenhuma altera coluna de tabela existente** (o `run.sh` confere).

## 4. Feature flags (estado depois do merge)
| Chave | Depois do merge | Liga quando |
| --- | --- | --- |
| `WJB_AI_ENABLED` | desligada | migrations do lote 1 + aprovação |
| `WJB_COMMERCIAL_ENABLED` | desligada | lote 2 + preços aprovados |
| `WJB_PAYMENTS_ENABLED` | desligada | Sandbox real aprovado + chaves de produção + aprovação de cobrança real |
| `WJB_AI_OFFICIAL_TRANSMISSION_ENABLED`, `WJB_AI_SEFIN_READ_AUTHORIZED` | desligadas | certificado novo, cofre, contrato conferido, autorização |
| `SAAS_PUBLIC_ENABLED`, `GCLICK_REAL_INTEGRATION_ENABLED` | sem mudança | - |

## 5. Rollback e contingência
- **Código:** commit de reversão do merge + push, ou reativar a versão anterior no painel da Hostinger, que guarda as últimas. Nunca voltar para antes do Next.js 16.4.6.
- **Módulo com problema:** desligar a chave `WJB_*` no painel (efeito imediato, sem redeploy).
- **Migration:** reverter só com backup e autorização; primeiro desligar a chave.
- **Contato:** o formulário mostra WhatsApp e e-mail se a API falhar, e a Dani encaminha para o WhatsApp.

## 6. Monitoramento pós-deploy e critérios de aprovação
| Critério | Ferramenta |
| --- | --- |
| Monitoramento sem falhas, **otimizador de imagens 200**, 0 erros no log | `monitorar.sh --servidor` |
| GTM sem dado pessoal (`dl`, `dr`, `dataLayer`) | `validar-gtm.mjs` (coleta bloqueada) |
| CI verde na `main` | `qa.yml` |
| Login do Portal e do Admin com MFA (pessoa da WJB) | manual |
| Lembretes do dia seguinte com sucesso, sem alerta de ausência | alertas |

## 7. Simulação da publicação (feita nesta fase, em homologação e CI)
Resultados no doc 10. Cobre:
- o candidato `feature/wjb-fase-10h`, que junta tudo à `main` atual;
- as migrations de 0001 a 0038 do zero, com backup, restauração, isolamento e rollback (job `banco`);
- o build e os 4 navegadores com os módulos **desligados** (como ficaria a produção);
- o *staging* com os módulos **ligados** na homologação;
- a regressão com o servidor em `0.0.0.0` e o otimizador de imagens, como na Hostinger.
