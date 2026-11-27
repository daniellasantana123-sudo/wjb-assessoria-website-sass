# Fase 10D - Status do roadmap, testes e pendências

**Data:** 26/11/2026. **Branch:** `feature/wjb-fase-10d`, a partir de `feature/wjb-fase-10c`. **Produção:** `main` = `70d08787` (hotfix do Next.js 16.4.6, publicado nesta fase).

## 1. Prioridades autorizadas: situação
| Prioridade | Situação | Documento |
| --- | --- | --- |
| P0 Hotfix do Next.js | **publicado e validado** em produção (16.3.7 → 16.4.6) | 01 |
| P0 Auditoria do banco de produção | **script pronto e testado**; aguarda a WJB rodar no painel (não há acesso de leitura com privilégio mínimo) | 02 |
| Certificado da WJB | bloqueios da 10C preservados; revogação e reemissão seguem como **pendência urgente** da titular | 05 da 10C |
| P1 Preparação da publicação da 10C | migrations revisadas (todas aditivas), fusão com a `main` limpa, chaves desligadas na produção, **PR #1 em rascunho**; merge aguarda autorização | PR #1 |
| P1 Fase 10D, certificados | adaptadores AWS Secrets Manager e Azure Key Vault + mocks + testes; nada contratado | 03 |
| P1 Fase 10D, NFS-e | preparação de cancelamento e substituição, erros e auditoria; envio bloqueado | 05 |
| P1 Fase 10D, pagamentos | métodos brasileiros pesquisados; alternativas ao Link; eventos assíncronos de Pix e boleto | 04 |
| Testes complementares em Linux | **CI criada** (`.github/workflows/qa.yml`); Chromium, Firefox e WebKit rodando | seção 2 |

## 2. Testes
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Unitários e integração | local (macOS, Node 24) | **715/715** (+24 na 10D) |
| Unitários e integração | **CI Linux, Node 22** | **715/715** (a 1ª execução falhou em 12 e revelou 2 problemas reais de portabilidade, seção 3) |
| `npm audit --omit=dev` | CI | **0** |
| E2E: site, Portal e Admin públicos em **Chromium, Firefox, WebKit e iPhone emulado** | CI Linux | **199 aprovados**, 0 falhas, 1 instável (seção 4) |
| Staging com login real e MFA / pagamentos simulados / webhook | local + homologação | **48/48**, **9/9**, **2/2** |
| Hotfix: regressão no build do próprio hotfix | local | 96/96 (antes da publicação) |
| Produção depois do hotfix | produção, só leitura | páginas, proteção das rotas, redirecionamentos, imagens, validação da API e cabeçalhos ok (doc 01) |
| Script de auditoria do banco | homologação, sessão somente leitura | 101 linhas, sem erro; escrita recusada pelo Postgres |

## 3. Problemas achados e corrigidos nesta fase
| Achado | Tratamento |
| --- | --- |
| **No Node 20 e 22 a política recusava todo certificado**: `X509Certificate.signatureAlgorithm` só existe no Node 24. A Hostinger oferece 20, 22 e 24 | algoritmo lido do DER quando a propriedade não existe; se as duas leituras divergirem, recusa (testado) |
| O erro conhecido do XSD oficial de produção aparece com outro texto no libxml2 do Ubuntu | verificador único e mais estrito: só esse erro, nos dois formatos (os testes antigos aceitavam qualquer erro em `serie`) |
| Pix e boleto confirmam depois do Checkout e os eventos de confirmação não estavam na lista do webhook | eventos `async_payment_*` adicionados; o acesso continua dependendo do estado atual no provedor |
| Os workflows de CI citados no `CLAUDE.md` nunca existiram no repositório | workflow `qa.yml` criado; `CLAUDE.md` corrigido |
| Logo depois do deploy, 4 cabeçalhos de segurança não apareceram numa leitura | minutos depois, presentes em todos os edges; a aplicação os envia (reproduzido em modo standalone). Causa provável: propagação no CDN. Conferido de novo no fim da fase: estáveis |

## 4. Riscos e pendências técnicas
| Item | Situação |
| --- | --- |
| Formulário de contato no **WebKit**: na CI, a mensagem de "enviada" não aparece em 5 s na **primeira** tentativa (passa na repetição; 3 vezes em 2 execuções) | investigar se o Safari real demora a carregar o validador sob demanda; não reproduzido em Chromium/Firefox |
| Código da 10C com o banco ainda na 0023 | não testado de ponta a ponta com Supabase; com as chaves desligadas, o código novo não toca as tabelas novas, e o limite de leads volta ao limite em memória |
| Cofre, cadeia ICP-Brasil e LCR/OCSP reais | dependem de contratação e do certificado novo |
| Envio de eventos, contrato JSON, algoritmo de assinatura | dependem do swagger autenticado |
| Login real no Portal e no Admin em produção | não testado por mim (sem credencial; banco em diagnóstico) |

## 5. Pendências da WJB
1. **Urgente:** rodar `scripts/wjb-ai/producao/auditoria-somente-leitura.sql` no SQL Editor da produção e me mandar o resultado (só contagens).
2. **Urgente:** revogar o certificado exposto e emitir um novo e-CNPJ.
3. Conferir Backups/PITR e plano no painel do Supabase (o script não alcança).
4. Decidir os métodos de pagamento (cartão + carteiras; Pix Automático e boleto dependem de prazo de recebimento e de convite da Stripe).
5. Responsável contábil: `indDest`, motivos e prazos de cancelamento, e quando substituir.

## 6. Autorizações necessárias
- Merge da 10C (PR #1), **depois** do diagnóstico do banco.
- Qualquer operação no banco de produção, inclusive aplicar migrations em lotes.
- Contratação do cofre.
- Chaves de teste da Stripe, gravadas pela pessoa autorizada.
