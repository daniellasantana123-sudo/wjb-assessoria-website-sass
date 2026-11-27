# Fase 10G - Status do roadmap, testes e evidências

**Data:** 27/11/2026. **Branch:** `feature/wjb-fase-10g` (a partir da 10F). **CI da última versão da 10F** (`8407639e`): verde.

**Produção:**
- `main` = `16138860`, versão Hostinger `01a21dbb`;
- publicados só os dois hotfixes autorizados e duas correções deles;
- nenhuma migration aplicada e nenhum módulo das Fases 10C a 10G publicado.

**PR #1:** fechado; a branch continua preservada.

## 1. Roadmap
| Frente | Status | Evidência |
| --- | --- | --- |
| Prévia pública conectada à produção | **CONCLUÍDO**: PR #1 fechado, prévia removida pela Hostinger em 12 s, respondendo 404 | doc 01 |
| Desligar as prévias automáticas no hPanel | **AGUARDANDO WJB** (exige login no painel) | doc 01 |
| Logs de acesso da Hostinger | **AGUARDANDO WJB** | doc 01 |
| Hotfixes de segurança e privacidade | **CONCLUÍDO E VALIDADO EM PRODUÇÃO**, com 2 falhas achadas na validação e corrigidas | doc 01 |
| Auditoria do Supabase | **AGUARDANDO WJB** (instruções simples e chamado revisado prontos) | doc 02 |
| Alertas das rotinas críticas | **PRONTO E ISOLADO** (`hotfix/alertas-rotinas`, sem migration); **AGUARDANDO AUTORIZAÇÃO** | doc 02 |
| Stripe Sandbox | **BLOQUEADO POR DEPENDÊNCIA EXTERNA**: nenhuma chave configurada; 13 cenários prontos (2 novos) | doc 03 |
| Estratégia financeira e origem única de cobrança | **EM TESTES** (0038 só na homologação); estratégia do PO registrada | doc 04 |
| AWS Secrets Manager | **PREPARADO** (guia, custos, alertas); contratação **AGUARDANDO APROVAÇÃO** | doc 05 |
| Certificado A1 | infraestrutura **PRONTA**; certificado real **AGUARDANDO SUBSTITUIÇÃO** | doc 06 |
| NFS-e | desenvolvimento **EM ANDAMENTO**; questionário do contador pronto; operações reais **BLOQUEADAS** | doc 07 |
| Proteção da `main` | configuração **PRONTA**; depende do `qa.yml` na `main` e de autorização | doc 08 |
| Homologação integrada | mapa por módulo e roteiro de Safari real **PRONTOS** | doc 09 |

## 2. Testes desta fase
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Hotfix combinado: lint, tipos, unitários, build, artefato, segredos | local | 0 avisos; 381 → **385** unitários |
| Hotfix combinado: E2E no build de produção | local (servidor em `0.0.0.0`, como a Hostinger) | **108/108** |
| Hotfix combinado: CI nos 4 navegadores | GitHub | 219 → **227** aprovados, **0 instáveis**, nas 3 versões publicadas |
| `images.spec.ts` (novo) | local | falha com o código anterior; passa com a correção |
| Monitoramento da produção após cada publicação | produção, só leitura | 1ª versão: **1 falha (imagens)**; versões seguintes: **sem falhas** |
| GTM/GA4 com dados fictícios e coleta bloqueada | local e produção | `dl`, `dr` e `dataLayer` **sem dado pessoal** |
| Branch 10G: lint, tipos, unitários | local | **767/767** |

## 3. Bugs encontrados e corrigidos
1. **Imagens otimizadas quebradas por cerca de 11 minutos** depois da publicação do bloqueio de endereço: o pedido interno do otimizador não tem cabeçalho Host. Corrigido e publicado; teste novo.
2. **Origem enviada ao GA4 com nome e telefone** quando o desafio do CDN recarrega uma página aberta com dados na URL. Corrigido e publicado.
3. Os testes locais não reproduziam a Hostinger, porque o servidor escutava em `localhost` e lá escuta em `0.0.0.0`. A regressão agora roda com `-H 0.0.0.0`.

## 4. Lição registrada
Validar **depois** do deploy, com o `monitorar.sh` e o teste do GTM, pegou as duas falhas que a CI não pegava. Não dispensar essa etapa.
