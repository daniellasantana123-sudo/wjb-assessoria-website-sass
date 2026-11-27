# Fase 10C - Relatório de implementação

**Data:** 26/11/2026. **Branch:** `feature/wjb-fase-10c`, a partir de `wjb-ai/10b-continuidade`. **Ambiente:** local e Supabase de homologação (`wjb-ai-homologacao`).

**O que NÃO foi feito:**
- merge na `main` ou deploy;
- qualquer operação no banco de produção;
- uso da chave de serviço da produção;
- uso de certificado real;
- chamada ao governo;
- emissão oficial;
- cobrança real;
- contratação de serviço;
- pedido de credencial pelo chat.

## 1. Base revisada antes de começar
- Os seis entregáveis da Fase 10B foram relidos. Nada já concluído foi reimplementado.
- Lacunas reais encontradas:
  - avisos de vencimento só aos 30 dias;
  - sem rotação de certificado;
  - lista de comprometidos só no código;
  - `indDest` fixo em 0;
  - cancelamento e substituição ausentes;
  - checklist do banco sem consultas;
  - comparativo de cofres incompleto.
- **Hotfix do Next.js** (`70d08787`) revisado e refeito do zero (seção 5).

## 2. Funcionalidades implementadas
| Área | O que entrou | Situação |
| --- | --- | --- |
| Certificado: ciclo de vida | registro com um ativo por titular, rotação atômica, lista **permanente** por impressão digital **e por chave pública**, avisos aos 90/60/30/15/7 dias e no vencimento | testado em homologação |
| Certificado: uso | só o ativo, no modelo e na empresa do pedido, fora das listas; registro fora do ar = negado | testado (local) |
| Certificado: Admin | `/admin/nfse/certificados`: registro, bloqueios e bloqueio manual (super admin + MFA, só impressão digital) | testado em homologação |
| Certificado: cadastro e rotação reais | funções prontas e testadas com certificados fictícios; sem botão, porque não há cofre contratado | bloqueado (cofre) |
| NFS-e: `indDest` | regra oficial; nunca presumido; campo opcional no Portal; visível para o contador; bloqueia o envio oficial sem declaração | testado em homologação, **aguarda o contador** |
| NFS-e: cancelamento | pedido `e101101` válido no XSD oficial | XML testado; envio bloqueado (contrato pendente) |
| NFS-e: substituição | grupo `subst` na DPS, válido no XSD | XML testado; regras e envio pendentes |
| NFS-e: contrato | caminho e campo de eventos registrados como pendente e inferido; o portão continua fechado | testado |
| Stripe Link | verificado: não disponível para empresa no Brasil; nada habilitado | documentado |
| Testes cross-browser | configuração opcional para Firefox e WebKit | **não executada** (macOS 13 sem suporte) |

**Migrations novas:**
- **0036:** ciclo de vida.
- **0037:** reforço da revisão de segurança.

Ambas são aditivas, aplicadas **só** no banco local e na homologação, com backup antes de cada uma e rollback testado.

**Integrações preservadas:**
- Omie/G-Click: nenhum arquivo alterado;
- Resend: só a função de envio passou a informar se gravou, sem mudar os envios existentes;
- WhatsApp Click-to-Chat;
- Portal, Admin, autenticação, MFA, documentos, empresas, usuários, pagamentos e notificações (regressão 96/96).

## 3. Arquivos
**Novos:**
- `supabase/migrations/0036_wjb_ai_certificate_lifecycle.sql`, `0037_wjb_ai_certificate_lifecycle_hardening.sql`;
- `src/lib/wjb-ai/fiscal/certificate-lifecycle.ts`, `certificate-rotation.ts`, `certificate-lifecycle.repo.ts`;
- `src/lib/wjb-ai/fiscal/national/ind-dest.ts`, `events-xml.ts`;
- `src/app/admin/nfse/certificados/page.tsx`;
- XSD oficiais de evento (`pedRegEvento`, `tiposEventos`);
- testes `wjb-ai-fase10c.test.ts`, `staging-fase10c.spec.ts`, `24/26_testes_0036/0037.sql`, `25/27_rollback_*.sql`, `10-certificados-ciclo-de-vida.mjs`;
- `playwright.crossbrowser.config.ts`;
- os 12 documentos desta pasta.

**Alterados:**
- `certificate-vault.ts` (consulta ao registro), `monitoring(.repo).ts`, `emitter-authorization.ts` (aviso aos 90 dias);
- `dps-xml.ts` (`indDest`, `subst`, caracteres proibidos), `official-transport.ts`, `draft.ts`, `form.ts`, `idempotency.ts`, `review.ts`;
- `nfse-request-form.tsx`, telas de correção e detalhe;
- `wjb-ai-admin.ts` (ação de bloqueio), `notifications.ts`, rota de alertas, `audit-labels.ts`, `database.ts`, `stripe-provider.ts` (só comentário);
- testes das fases 6 e 10B;
- `run.sh` e `staging.sh`;
- 5 specs E2E (identificação do celular);
- `responsive-audit.spec.ts`.

## 4. Correções realizadas
**Revisão de segurança independente**, por um agente que recebeu só o código, sem as minhas conclusões: 3 achados médios e 7 baixos, **todos corrigidos**. O detalhe está no doc 02, seção 5. Os principais:
- bloqueio também pela **chave**: um certificado reemitido com o mesmo par de chaves não escapa;
- o uso confere modelo e empresa;
- apagar o perfil de quem bloqueou não trava mais;
- documento do titular e referência do cofre fora da API da equipe.

**Achados durante os testes:**
- anônimo com permissão de leitura nas tabelas novas: removida;
- dois testes que passavam pelo motivo errado: corrigidos para recusar pela regra.

## 5. Resultados dos testes
| Bateria | Resultado |
| --- | --- |
| Unitários e integração | **691/691** |
| Banco local, incluindo rollback 0037 → 0024 | **188 OK** |
| API real da homologação: certificados / fiscal / comercial / pagamentos / MFA no banco | **21 / 56 / 14 / 12 / 11**, sem falhas |
| Telas com login real e MFA / pagamentos simulados / webhook | **48/48**, **9/9**, **2/2** |
| Responsividade e acessibilidade | **497 medições**, 0 problemas |
| Regressão (Chrome desktop + celular) | **96/96** |
| Hotfix: Vitest / build / regressão de telas no build dele | **373/373** / ok / **96/96** |
| `npm audit` / varredura de segredos | **0** / **0 reais** |
| Firefox, WebKit, Stripe real, governo, produção | **não executados** (doc 09, seção 4) |

## 6. Pendências técnicas
| Pendência | Depende de |
| --- | --- |
| `createCertificateVault()`, `createIcpBrasilTrustStore()`, `createRevocationChecker()` reais | contratação do cofre (B1) e raízes do ITI |
| Contrato JSON da SEFIN, caminho de eventos, algoritmo de assinatura | certificado novo + leitura autorizada do swagger |
| Grupo `dest` (destinatário diferente do tomador) | resposta do contador (C1) |
| Evento `e105102` e regras de substituição e cancelamento | swagger/Anexo I + contador (C2, C3) |
| Telas de cancelamento e substituição | primeira emissão oficial |
| Assinatura do pedido de evento | algoritmo confirmado |
| Agrupar a auditoria do portão na rota da fila (herdado da 10B) | baixo risco; não feito |
| Release 3 da NT 009 (série no ID) | publicação do leiaute |
| Testes em Firefox/Safari | máquina Linux ou macOS 14 ou mais novo |
| gitleaks no CI | aprovação para adicionar a ferramenta |

## 7. Autorizações necessárias (separadas)
1. **Deploy do hotfix do Next.js** (merge de `hotfix/next-16.4.6-security` na `main`). A produção tem advisories críticos.
2. **Uso da chave de serviço da produção**, só leitura, para contar usuários e tabelas. Alternativa: a WJB roda o checklist do doc 03 no painel.
3. **Qualquer recuperação do banco**, primeiro num projeto separado (doc 04).
4. **Contratação do cofre** (doc 06).
5. **Leitura autenticada do swagger** com o certificado novo, depois dos itens acima.
6. **Merge desta branch** (`feature/wjb-fase-10c`) e das anteriores, em etapas (doc 51). Publicar não liga nada: tudo continua atrás de variáveis desligadas.

## 8. Recomendação para a próxima fase
1. **Imediato e independente do resto:** publicar o hotfix do Next.js, com autorização.
2. **Em paralelo:** diagnosticar o banco de produção (doc 03), revogar e reemitir o certificado, e decidir o cofre.
3. **Fase 10D**, quando houver certificado novo e cofre:
   - implementar o cofre, a cadeia ICP-Brasil e a LCR/OCSP;
   - cadastrar e girar o novo e-CNPJ em homologação;
   - fazer a leitura autenticada do swagger para fechar o contrato e o algoritmo.

   Só depois disso planejar o primeiro envio em produção restrita.
4. Sandbox da Stripe assim que as chaves de teste forem gravadas pelo script.
