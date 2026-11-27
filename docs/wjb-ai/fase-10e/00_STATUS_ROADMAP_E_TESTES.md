# Fase 10E - Status do roadmap, testes e pendências

**Data:** 26/11/2026. **Branch:** `feature/wjb-fase-10e` (a partir da 10D). **Produção:** `main` = `70d08787` (hotfix do Next.js 16.4.6), sem nenhuma mudança nesta etapa. **PR #1:** rascunho.

## 1. Roadmap
| Atividade | Status | Evidência |
| --- | --- | --- |
| Hotfix do Next.js 16.4.6 | **CONCLUÍDO** (publicado na etapa anterior) | monitoramento sem falhas (doc 02) |
| Monitoramento pós-hotfix | **CONCLUÍDO** (script reaproveitável) | `scripts/wjb-ai/producao/monitorar.sh` |
| Indícios de comprometimento | **CONCLUÍDO dentro do alcance** | nada encontrado nos logs disponíveis; logs de acesso dependem da Hostinger (doc 02) |
| Auditoria do banco de produção | **AGUARDANDO** a WJB rodar o script | script + analisador + critérios (doc 01) |
| Linha do tempo do incidente do banco | **CONCLUÍDO** (evidência nova) | problema entre 12/10 20:00 e 13/10 17:49 UTC; tabela de volta em 26/11 (doc 01) |
| Checklist de backups/PITR e recuperação isolada | **CONCLUÍDO** (documento) | doc 01, seções 4 e 5 |
| Correção dos formulários no WebKit | **CONCLUÍDO e testado** | 0 instáveis em 2 execuções da CI (doc 03) |
| Pagamentos: Pix Automático, boleto, avulso | **EM TESTES** (simulado e unitário) | Sandbox real depende das chaves de teste (doc 04) |
| Honorários e serviços adicionais | **BLOQUEADO** por decisão da WJB | preços não aprovados; fonte de cobrança × Omie (doc 04) |
| CI/CD e DevSecOps | **CONCLUÍDO** | 4 jobs verdes (doc 05) |
| Proteção da `main` | **AGUARDANDO AUTORIZAÇÃO** | proposta no doc 05 |
| Plano de publicação 10C/10D/10E | **CONCLUÍDO** (documento) | doc 06 |
| Merge das Fases 10C, 10D e 10E | **AGUARDANDO AUTORIZAÇÃO** | depois da auditoria e de desligar as prévias |
| Certificado A1 (revogação e reemissão) | **BLOQUEADO POR DEPENDÊNCIA EXTERNA** (titular) | bloqueios preservados |
| Cofre (AWS/Azure) | **EM DESENVOLVIMENTO** (adaptadores prontos, Fase 10D) | contratação não autorizada |
| NFS-e: XSD, emissão simulada, cancelamento, substituição, rejeições, histórico, auditoria, permissões | **CONCLUÍDO em simulação** (Fases 7 a 10D); nenhuma mudança nesta etapa | regras fiscais pendentes do contador |
| NFS-e: `indDest`, destinatário diferente, prazos de cancelamento, substituição, regras por município | **PENDENTE** de validação do responsável contábil | não presumido |
| Integrações governamentais reais | **BLOQUEADO** (certificado, cofre, swagger) | portão fechado |
| Prévia pública da Hostinger com `.env` de produção | **AGUARDANDO DECISÃO** da WJB | doc 02, seção 3 |

## 2. Testes desta etapa
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Unitários | local | **729/729** (+14) |
| Unitários | CI Linux, Node 22 e 24 | ✅ ✅ |
| Lint, TypeScript, segredos, `npm audit --omit=dev` | CI | ✅ (0 vulnerabilidades) |
| Banco: migrations, RLS, isolamento, MFA no banco, backup, rollback | CI (Postgres descartável) | ✅ |
| E2E em Chromium, Firefox, WebKit e iPhone emulado | CI Linux | **216 aprovados, 0 instáveis, 0 falhas** (2 execuções) |
| Regressão local (Chrome desktop e celular) | local | **104/104** |
| Staging com login real e MFA / pagamentos simulados / webhook | homologação | **48/48**, **9/9**, **2/2** |
| Monitoramento da produção | produção, só leitura | sem falhas |
| Analisador da auditoria com o resultado **real** da homologação | homologação, sessão somente leitura | classificou corretamente (contas de teste → caminho D) |

## 3. Bugs corrigidos
1. **Dados pessoais na URL e envio perdido** quando o clique vinha antes da hidratação (formulário sem `method`).
2. **Texto digitado apagado na hidratação**: a causa real da instabilidade no WebKit, comprovada por experimento.
3. Formulário silencioso quando o validador não carrega: agora mostra o erro com WhatsApp e e-mail.
4. Detector de segredos que não pegava chave privada real (achado no próprio teste do detector).
5. Monitor que ignorava o modo `--servidor` (argumento sobrescrito no laço).

## 4. Riscos
| Risco | Situação |
| --- | --- |
| **Prévia pública com código da 10C usando o `.env` de produção** | ativa desde 26/11 21:56; aguarda decisão |
| Banco de produção: estado desconhecido; problema desde 13/10 | aguarda a auditoria e o suporte |
| Sem log de acesso HTTP para descartar exploração antes do hotfix | pedir à Hostinger |
| Rotina com falha por 44 dias sem alarme | ativar notificação de falha no GitHub |
| Contas de teste com `super_admin` em produção (registrado em 23/09) | a auditoria vai mostrar; remover |

## 5. Pendências externas (WJB)
1. **Rodar a auditoria** do banco e enviar o CSV.
2. **Decidir sobre a prévia da Hostinger**: desligar as prévias, fechar o PR #1 ou aceitar o risco.
3. Backups e PITR no painel (checklist do doc 01), e o **chamado ao suporte com a janela de 12-13/10**.
4. Revogar e reemitir o certificado.
5. Pedir à Hostinger os logs de acesso do período vulnerável.
6. Pagamentos: como os honorários são cobrados hoje, métodos (Pix Automático e boleto), chaves de teste da Stripe.
7. Contador: `indDest`, cancelamento e substituição.

## 6. Autorizações necessárias
- Proteção da `main` no GitHub (doc 05).
- Merge (10C + 10D + 10E) e, depois, as migrations em lotes (doc 06).
- Qualquer operação no banco de produção, inclusive recuperação em projeto separado.
- Contratação do cofre.

## 7. Próximas prioridades
1. Analisar o CSV da auditoria assim que chegar e decidir o caminho (A a D).
2. Resolver a prévia da Hostinger antes de qualquer novo PR.
3. Com autorização: proteção da `main`, depois a publicação em etapas (doc 06).
4. Sandbox real da Stripe, quando houver chaves de teste.
5. NFS-e: incorporar as respostas do contador.
