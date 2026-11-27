# Fase 10E - Monitoramento pós-hotfix, indícios de comprometimento e prévia da Hostinger

**Data:** 26/11/2026. Tudo só leitura. Nada foi revertido, e a produção continua no Next.js 16.4.6.

## 1. Monitoramento (`scripts/wjb-ai/producao/monitorar.sh --servidor`)
| Verificação | Resultado |
| --- | --- |
| Disponibilidade e desempenho (12 páginas públicas, `/login`, sitemap e robots) | todas **200**, tempo até o primeiro byte de 0,04 a 0,10 s |
| Portal e Admin (`/portal`, `/admin`, NFS-e, manual) | todos exigem login (307 para `/login?next=`) |
| Redirecionamentos (`www.`, `/home`, WordPress antigo, 404) | corretos (308, 308, 410, 404) |
| Cabeçalhos de segurança (6), 3 leituras sem cache | **presentes nas 3** |
| Formulário comercial | a API recusa dado inválido (400), nada gravado |
| Otimizador de imagens | 200 |
| Logs da aplicação | `stderr` vazio; os 4 erros são todos `lsnode: no request in 300 seconds` (o servidor encerra o processo ocioso, que volta na próxima visita): **0 erros reais** |

O script pode rodar a qualquer momento e falha se algum item sair do esperado. Ele não envia lead, não faz login e não exibe conteúdo de log.

## 2. Indícios de comprometimento anteriores ao hotfix
**Limite das fontes:** a Hostinger não expõe por SSH o log de acesso HTTP. Os únicos registros são os logs da aplicação das versões guardadas no servidor, cobrindo **10/11 a hoje**.

| Busca nos logs (só contagens) | Resultado |
| --- | --- |
| "Server Action", "Failed to find" (abuso de Server Actions) | 0 |
| `_next/image`, "svg" (otimizador de imagens, alvo do advisory crítico) | 0 |
| `child_process`, `spawn`, `eval` (execução de comando) | 0 |
| "unhandled", `ECONN` | 0 |
| Linhas de erro | todas explicadas: falhas da rotina de lembretes (tabela ausente) e encerramento de processo ocioso |
| Arquivos alterados fora da área de build, desde 10/11 | nenhum encontrado |

**Conclusão honesta:** não há sinal de exploração **nas fontes disponíveis**. Isso **não prova** que não houve. Sem log de acesso e sem logs anteriores a 10/11, uma exploração do otimizador de imagens ou de Server Actions pode não ter deixado rastro aqui.

**Recomendação:** pedir à Hostinger os logs de acesso do período em que versões vulneráveis do Next.js estiveram no ar (até 26/11, 21:48) e procurar requisições a `/_next/image` com `.svg` e POSTs com o cabeçalho `Next-Action` desconhecidos.

## 3. Achado: prévia pública da Fase 10C com o .env de PRODUÇÃO
**O que aconteceu:**
- ao criar o PR #1 (rascunho, 26/11 21:56), a integração da Hostinger com o GitHub compilou a branch `feature/wjb-fase-10c` em modo **preview**;
- publicou em **`https://calm-hotpink-okapi-85.hostingersite.com`**;
- a prévia usa a mesma pasta de builds e o **mesmo `hbuilds/config/.env` da produção**: Supabase de produção, Resend, G-Click real e segredo das rotinas.

Eu não sabia que esse modo existia: não está em nenhum documento do projeto. Agora está registrado.

| Item | Situação |
| --- | --- |
| Produção (`wjbassessoriacontabil.com.br`) | **não foi trocada**: continua no hotfix (`current` = `01a21a76`) |
| Prévia no ar | **sim**: site, `/login` e redirecionamentos do Portal e Admin respondem; `x-robots-tag: noindex` |
| Módulos da 10C na prévia | **desligados** (as chaves `WJB_*` não existem no `.env`; `/emissao-de-notas` dá 404) |
| Risco | um login ou contato feito na prévia vai para o **banco e os e-mails de produção**, com código ainda não aprovado. Na prática, é uma publicação parcial da 10C que ninguém autorizou |

**O que fiz:**
- não mexi na Hostinger;
- não fechei o PR (você pediu para mantê-lo em rascunho);
- não fiz push na branch da 10C nem abri PR das branches 10D e 10E, para não criar outras prévias.

**Decisão necessária da WJB (escolher uma):**
1. **Desligar as prévias** no hPanel (recomendado) e apagar a prévia existente;
2. ou **fechar o PR #1** (a prévia deve sair; dá para reabrir depois);
3. ou aceitar o risco, sabendo que a prévia usa os dados de produção.

## 4. Desempenho
Tempo até o primeiro byte entre 0,04 e 0,10 s nas páginas públicas, com o CDN. O PageSpeed (Core Web Vitals) só pode ser medido pelo navegador do responsável, porque a API pública sem chave estoura a cota.
