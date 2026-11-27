# Fase 10H - Status do roadmap, testes e critérios para a Fase 11

**Data:** 27/11/2026. **CI da 10G** (`95101f4c`): verde.

**Produção:**
- `main` = `e2576a38`, versão Hostinger `01a21dd6`;
- publicados nesta fase só os **alertas das rotinas** e a **CI**, os dois sem mudar o site;
- nenhuma migration e nenhum módulo novo.

**Candidato ao go-live:** `feature/wjb-fase-10h` (`22165ce8`), que entra na `main` sem conflito.

## 1. Roadmap
| Frente | Status | Evidência |
| --- | --- | --- |
| Alertas das rotinas críticas | **PUBLICADO E VALIDADO** (falha simulada, sem duplicata, fechamento, execução real pelo GitHub) | doc 01 |
| Alerta de rotina sem execução | **PUBLICADO E VALIDADO** | doc 01 |
| CI na `main` | **PUBLICADA E EXECUTADA** (5 jobs verdes) | doc 05 |
| Proteção da `main` | **PRONTA, NÃO APLICADA**: condição "prévias desligadas" não cumprida | doc 05 |
| Prévias automáticas da Hostinger | **AGUARDANDO WJB**; nenhuma prévia ativa | doc 02 |
| Privacidade (formulários e GA4) | correções **em produção e verificadas**; registro do incidente **para o encarregado** | doc 03 |
| Auditoria do banco | **AGUARDANDO WJB** | doc 04 |
| Stripe Sandbox | **NÃO CONCLUÍDO**, sem chaves | doc 06 |
| Omie / G-Click / origem única | preservados; 0038 validada (banco, unitário, staging) | docs 10 e 11 |
| AWS Secrets Manager | **PREPARADO**, contratação pendente | doc 07 |
| Certificado A1 | infraestrutura validada com fictícios; real **BLOQUEADO** | doc 08 |
| NFS-e | validação simulada **concluída**; oficial **BLOQUEADO** | doc 09 |
| Homologação integrada e simulação do go-live | **EXECUTADAS** | docs 10 e 11 |

## 2. Funcionalidades efetivamente validadas nesta fase
- Alertas em produção: um issue por falha, sem duplicata, fechamento automático e detecção de ausência de execução.
- CI rodando na `main`.
- Produção depois de cada publicação: monitoramento sem falhas, imagens 200, 0 erros, GTM sem dado pessoal.
- Candidato completo: migrations do zero com rollback, 4 navegadores, staging com módulos ligados, modo da Hostinger.

## 3. Bugs e riscos encontrados nesta fase
1. **A branch de alertas antiga desfaria os hotfixes de segurança** (partia da `main` antiga). Refeita sobre a `main` atual; a antiga não foi usada.
2. **Erro de script:** a verificação de execução lia o corpo do erro da API como data; corrigido antes de publicar.
3. **Os lembretes chegam à tarde, não às 8h**: o GitHub atrasa o agendamento em 6 a 11 h (decisão da WJB no doc 01).
4. **Guia da Stripe com passo impossível** ("pular o webhook", mas o script exige o segredo): corrigido com o Stripe CLI.

## 4. Testes
| Bateria | Resultado |
| --- | --- |
| Alertas: simulação, duplicata, fechamento, execução real | 4/4 comportamentos esperados |
| CI na `main` (`e2576a38`) | 5 jobs verdes |
| CI do candidato (`22165ce8`) | 5 jobs verdes; banco sem falhas; E2E **228 aprovados, 0 instáveis** |
| Unitários | **767/767** |
| Staging (homologação) | **49/49**, pagamentos **11/11**, webhook **2/2** |
| Regressão no modo Hostinger | **110/110** |
| Produção pós-deploy (2 publicações) | monitoramento sem falhas; GTM sem dado pessoal |

**Não testado:** Stripe real, Safari real, banco de produção, certificado real e governo.

## 5. Critérios para iniciar a Fase 11 (publicação das Fases 10C a 10H)
Todos obrigatórios:
1. Auditoria do banco analisada e caminho decidido; backup ou PITR com restauração **testada** em projeto separado.
2. Resposta do Supabase sobre 12 e 13/10 (ou registro de que não há backup).
3. Prévias desligadas no hPanel, conferido por um PR de teste sem prévia.
4. Proteção da `main` aplicada.
5. Encarregado de dados ciente do registro de privacidade.
6. Aprovação expressa do PR do candidato e do lote 1 de migrations.

O Sandbox da Stripe, o certificado e o cofre **não** bloqueiam a Fase 11: os módulos entram desligados e são ligados depois, um por vez.
