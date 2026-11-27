# Fase 10G - Prévias da Hostinger e publicação dos hotfixes

**Resumo:** a prévia pública foi desativada; os dois hotfixes foram publicados. A validação depois do deploy encontrou **duas falhas reais**, as duas corrigidas e publicadas no mesmo dia: imagens quebradas e a origem enviada ao GA4. Nenhum módulo das Fases 10C a 10G foi publicado e nenhuma migration foi aplicada.

## 1. Prévias (P0)
| Passo | Evidência (27/11, UTC) |
| --- | --- |
| Desligar as prévias no painel | **não feito por nós**: exige login da WJB no hPanel (ver seção 4) |
| Alternativa autorizada: fechar o PR #1 | 15:28:24, com comentário; estado antes de fechar em `evidencias/pr1-antes-de-fechar.json` |
| Branches e commits preservados | `feature/wjb-fase-10c` continua em `3cc68b7c` no GitHub |
| A Hostinger retirou a prévia | versão `01a21a80` removida do servidor às **15:28:36** (12 s depois) |
| A prévia deixou de responder | `/` 403, `/login` 404, `/api/leads` 404 |
| Outras prévias | nenhuma: só `01a21a80` teve `Mode: preview` nos logs; o domínio temporário `…-794036.hostingersite.com` só serve a página padrão da Hostinger |
| Log de build da prévia | preservado no servidor (`hbuilds/logs/01a21a80…`); sha256 dos arquivos em `docs/wjb-ai/fase-10f/evidencias/` |

**Inícios do processo da prévia** (o servidor só inicia ao receber um pedido): 01:37, 13:46, 14:03 e 15:28 de 27/11. Todos coincidem com verificações nossas: a da Fase 10E, os `curl` da 10F, o `monitorar.sh` (que passou a consultar a prévia) e a captura antes de fechar. **Não há indício de acesso de terceiros. Limite:** sem o log de acesso HTTP da Hostinger, isso não é prova.

**Rotação de credenciais:** não há indício de vazamento (nenhum segredo no código enviado ao navegador; nenhum acesso de terceiros identificado). **Não é necessária pelos fatos levantados.** Recomendação de baixo custo: girar o `CRON_SECRET` se o log de acesso pedido à Hostinger mostrar qualquer pedido à prévia que não seja nosso.

## 2. Publicação dos hotfixes (P0)
| Condição do PO | Evidência |
| --- | --- |
| Prévia desativada | seção 1 |
| CI verde | branch combinada `hotfix/seguranca-20261127`: 4 navegadores, **219 aprovados, 0 instáveis** |
| Diff revisado | 19 arquivos: formulários, bloqueio de endereço, testes e cópias idênticas de scripts de CI |
| Sem migrations | nenhum arquivo em `supabase/` |
| Sem funcionalidades da 10C a 10F | nada em `wjb-ai`, `payments`, `commercial`, `nfse`, `fiscal`, `package.json` ou `next.config` |
| Regressão | local, build de produção: lint, tipos, 381 unitários, E2E 106/106 |
| Rollback | `main` anterior `70d08787`; versão anterior `01a21a76` guardada na Hostinger. Voltar = commit de reversão + push, ou reativar a versão no painel. Nunca voltar para antes do Next.js 16.4.6 |
| Nenhum dado pessoal pela URL | testes `forms-hydration` (JS desligado, hidratação lenta, clique duplo, link antigo) |

**Publicação:** avanço rápido da `main`, sem PR, para não criar prévia:
| Hora (UTC) | Commit na `main` | Versão Hostinger | O quê |
| --- | --- | --- | --- |
| 15:36 | `195db04a` | `01a21da6` (15:40) | hotfixes A + B |
| 15:47 | `686a4a0a` | `01a21db0` (15:51) | **correção 1**: imagens |
| 15:59 | `16138860` | `01a21dbb` (16:03) | **correção 2**: origem enviada ao GA4 (+ teste E2E das imagens) |

## 3. Validação depois do deploy, e as duas falhas encontradas
**Falha 1: imagens otimizadas quebradas (15:40 a 15:51, cerca de 11 minutos).**
- Sintoma: o `monitorar.sh` acusou "FALHA otimizador de imagens", e o log mostrou `internal image response failed … 421`.
- Causa: o otimizador do Next busca o arquivo no próprio servidor com um pedido interno **sem cabeçalho Host**, e o bloqueio recusa pedido sem Host. Os testes locais não pegaram porque o servidor local escutava em `localhost`; na Hostinger escuta em `0.0.0.0`.
- Correção: arquivos estáticos de imagem e fonte passam pelo bloqueio, porque não tocam sessão, banco nem integração. Páginas, login, API e Server Actions continuam recusados.
- Reproduzida e corrigida localmente com o servidor em `0.0.0.0` antes de publicar.
- **Novo teste `images.spec.ts`**: falha com o código anterior e passa com a correção.

**Falha 2: origem (`dr`) enviada ao GA4 com dados de formulário.**
- Validação em produção com cookies aceitos e dados **fictícios** na URL. A URL da página (`dl`) já saía limpa.
- A origem (`document.referrer`) trazia nome e telefone: o desafio anti-robô do CDN recarrega a página que chegou com dados.
- Correção: `gtag('set', {page_referrer})` com a origem sem os campos, antes de qualquer tag.
- Verificada com a **coleta bloqueada** (nada enviado ao Google), localmente e em produção no cenário real do desafio: `dl` e `dr` limpos, 0 ocorrências.
- O GA4 já mascarava o e-mail sozinho, mas não o nome nem o telefone.
- **Atenção WJB:** as duas primeiras execuções da validação, antes de a coleta ser bloqueada, enviaram ao GA4 alguns acessos com dados fictícios (`utm_source=validacao10g`, "Maria Ficticia"). Podem ser ignorados ou filtrados.

**Validação final (versão `01a21dbb`):**
| Item | Resultado |
| --- | --- |
| Site comercial (12 páginas, sitemap, robots) | 200, com tempo até o primeiro byte entre 0,05 e 0,3 s |
| Portal e Admin | exigem login (307 para `/login?next=`) |
| Formulários | `method="post"`; API recusa dado inválido (400), nada gravado |
| Cabeçalhos de segurança | 6 de 6, nas 3 leituras |
| Redirecionamentos | `www` 308, `/home` 308, WordPress 410, inexistente 404 |
| Imagens | otimizador 200 |
| Logs | `stderr` vazio, 0 erros |
| GTM e GA4 | GTM carrega com consentimento; `dl`, `dr` e `dataLayer` sem dado pessoal |
| Prévia antiga | 404 |

## 4. O que ainda depende da WJB
1. **Desligar as prévias automáticas no hPanel**: em Websites → o site → Git (ou Implantações), procurar a opção de prévias de *pull request*. O caminho exato não foi conferido por nós.
   - Desde hoje, a `main` responde 421 em qualquer `*.hostingersite.com`, então prévias de branches novas já nascem bloqueadas.
   - Mesmo assim, o código é proteção complementar, não o isolamento. **A prévia continua usando o `.env` da produção** enquanto o recurso estiver ligado.
2. **Pedir à Hostinger** os logs de acesso de 26/11 21:56 a 27/11 15:29 UTC (prévia) e do período em que versões vulneráveis do Next.js estiveram no ar (até 26/11 21:48 UTC).
3. Separar as credenciais por ambiente: um servidor de homologação, quando existir, com o próprio `.env` e o projeto Supabase de homologação.
