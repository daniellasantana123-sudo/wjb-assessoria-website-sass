# Fase 10B - Relatório de implementação

**Data:** 26/11/2026.
**Branch:** `wjb-ai/10b-continuidade`, a partir de `wjb-ai/10a-hardening`, que já contém `wjb-ai/f2-solicitar-nfse`.
**Ambiente:** local e Supabase de homologação (`wjb-ai-homologacao`).

**O que NÃO foi feito:**
- merge na `main` ou deploy;
- qualquer alteração na produção (banco ou painel);
- uso do certificado exposto;
- chamada ao governo;
- emissão oficial;
- cobrança real;
- contratação;
- Cloud API;
- IA externa.

## 0. Base verificada antes de começar
- **`main` (`a7d15d22`):** é a produção atual.
- **Hotfix `hotfix/next-16.4.6-security` (`70d08787`):** 1 commit à frente da `main`, só `package.json` e o lock.
- **`wjb-ai/10a-hardening` (`c5f74709`):** 18 commits à frente da `main`, sem divergência.
- A **16.4.6** continua sendo a versão estável mais recente do Next.js em 26/11 (as 16.5 ainda são canary).
- Não há arquivo `.env.stripe.local` com chaves de teste, então a Stripe segue no modo simulado (seção 5).

## 1. Execução dos agentes
A Fase 10B pede 10 papéis. Três trabalharam como **agentes separados**:
- **Integrações / NFS-e:** pesquisa da documentação pública do gov.br/nfse.
- **Segurança / AppSec:** revisão independente do código novo, sem receber minhas conclusões.
- **Arquitetura:** a coordenação, feita por mim.

Os demais papéis rodaram em sequência, por mim mesmo:
- backend;
- QA;
- UX;
- DevOps;
- pagamentos;
- produto/compliance.

A revisão de segurança apontou 4 itens médios e 9 baixos de defesa em profundidade. **Nenhum abria caminho para certificado real, governo ou produção.** Corrigi os 4 médios e 8 baixos. O único que ficou está explicado na seção 6.

## 2. Arquivos novos
| Arquivo | Função |
| --- | --- |
| `src/lib/wjb-ai/fiscal/national/certificate-policy.ts` | política do certificado real, falha fechada (cadeia, revogação, algoritmo, incidente) |
| `src/lib/wjb-ai/fiscal/national/official-transport.ts` | transporte oficial com cliente HTTP injetado e contrato JSON classificado |
| `src/lib/wjb-ai/fiscal/national/transmission-gate.ts` | portão único da transmissão oficial |
| `src/lib/wjb-ai/fiscal/national/transmission-gate.repo.ts` | auditoria dos bloqueios no `audit_log` |
| `src/lib/wjb-ai/fiscal/national/gate-token.ts` | comprovante de portão aberto, exigido pelo transporte com cliente real |
| `src/lib/wjb-ai/fiscal/national/rejeicoes-producao-restrita-v1.01-20261124.json` | catálogo oficial de rejeições do Anexo I de 24/11 |
| `src/components/wjb-ai/admin/transmission-gate-panel.tsx` | painel "Transmissão oficial" em `/admin/nfse`, só leitura |
| `docs/wjb-ai/oficial/xsd/producao-restrita-nt009-r2-20261124/` | XSD oficial do release 2, sem alteração |
| `src/tests/helpers/test-pki.ts` | PKI fictícia efêmera para testes |
| `src/tests/unit/wjb-ai-fase10b.test.ts` | 42 testes |
| `src/tests/e2e/staging-fase10b.spec.ts` | 2 testes de tela em homologação |

## 3. Arquivos alterados
| Arquivo | Mudança |
| --- | --- |
| `fiscal/certificate-vault.ts` | `useCertificate` aplica a política; `trust` e `revocation` são obrigatórios (`null` = negado); modelo desconhecido usa as regras da WJB; `server-only` |
| `national/dps-xml.ts`, `national/layouts.ts` | leiaute r2 + `indDest` obrigatório em `infDPS` |
| `national/rejection-catalog.ts` | catálogo r2 |
| `fiscal/labels.ts` | `SIMULATION_LABEL` único |
| `components/wjb-ai/fiscal-status-badge.tsx` | aviso com o rótulo único e versão para a equipe |
| `app/admin/nfse/*` (4 telas) | aviso de simulação para a equipe; painel do portão |
| `fiscal/notices.ts` | todo aviso de NFS-e termina com o rótulo; "aprovada" diz que o envio é simulado |
| `fiscal/preview.ts` | API devolve `fiscalValue: false` e `notice` |
| `app/api/wjb-ai/cron/processar-fila/route.ts` | modo oficial passa pelo portão, que audita, e devolve os códigos |
| `lib/audit-labels.ts` | rótulo `fiscal.transmission_blocked` |
| `tests/unit/wjb-ai-fase6.test.ts` | usa a PKI de teste e passa a política |
| `scripts/.../staging.sh` | inclui o spec da Fase 10B |
| `tests/e2e/staging-nfse-admin.spec.ts`, `tests/e2e/staging-payments.spec.ts` | limites de tempo ajustados à latência da homologação (matriz, seção 3) |
| `oficial/xsd/FONTE.md`, docs 52 e CLAUDE.md | registro |

**Sem migration nova.** **Omie/G-Click:** nenhum arquivo alterado.

## 4. O que cada prioridade entregou
1. **Conector fiscal e contratos.**
   - **Achado real:** a DPS era recusada pelo XSD que vale em produção restrita desde 24/11.
   - Corrigido e validado nos 3 pacotes oficiais.
   - Transporte oficial com testes de contrato sem rede: emissão, rejeição, indeterminado, consulta, conciliação e concorrência.
   - O contrato JSON tem cada campo marcado; o portão recusa enquanto houver campo inferido ou pendente.
2. **Assinatura e custódia.**
   - Política de certificado completa.
   - O certificado exposto fica inutilizável por regra, sem que o projeto o conheça.
   - O transporte real só existe com o portão aberto.
   - Recomendações de cofre no doc `FASE-10B-CERTIFICADOS-E-SEGREDOS`.
3. **Portal, Admin e agentes.**
   - Rótulo único de simulação em telas, avisos e API.
   - Painel do portão para a equipe.
   - A Dani e o WhatsApp Click-to-Chat não mudaram: já dizem que nenhuma nota é emitida.
   - O agente `explain_rejection` passa a reconhecer o catálogo de 24/11.
4. **Testes em homologação:** ver `FASE-10B-MATRIZ-TESTES`.
5. **Stripe Sandbox:** seção 5.
6. **Recuperação da produção:** trilha separada, `FASE-10B-PLANO-RECUPERACAO-PRODUCAO`.

## 5. Stripe
- Sem chaves de teste neste computador, então **nenhuma chamada à Stripe foi feita**, e nenhum resultado é afirmado.
- O que existe e está testado com o provedor simulado (Fase 9.1):
  - Checkout e Billing;
  - webhook com assinatura HMAC e janela de 300 s;
  - idempotência por id de evento;
  - estado sempre buscado no provedor;
  - live recusado no código e no banco.
- Próximos passos (Portão 7 do checklist):
  1. `node scripts/wjb-ai/stripe/configurar-chaves.mjs` (lê da área de transferência; recusa `sk_live_`, `rk_live_` e `pk_live_`);
  2. `bash scripts/wjb-ai/stripe/sandbox.sh` (Test Clocks e cartões de teste);
  3. URL pública de homologação para o webhook.

## 6. Pendências técnicas desta fase
| Item | Por quê |
| --- | --- |
| Agrupar no tempo a auditoria de bloqueio do portão na rota da fila | hoje cada chamada autenticada gera uma linha. Exige o `CRON_SECRET` e o modo oficial está desligado: risco baixo |
| `indDest=0` | confirmação do contador |
| Release 3 da NT 009 (mudança da série no ID) | aguarda publicação do leiaute |
| Texto dos PDFs públicos de 23/11 (manuais de municípios e do ADN) | fontes codificadas; não é o contrato dos contribuintes |
