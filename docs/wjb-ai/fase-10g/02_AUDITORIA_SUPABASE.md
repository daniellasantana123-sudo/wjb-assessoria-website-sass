# Fase 10G - Auditoria do Supabase (P0)

**Situação:** continua aguardando a WJB. **Nada foi executado no banco de produção**, e a chave de serviço da produção não foi usada. Critérios, linha do tempo e recuperação isolada: doc 02 da Fase 10F (continua válido).

## 1. Instruções simples para o responsável da WJB (cerca de 10 minutos)
1. Entre em **supabase.com** com a conta dona do projeto e abra o projeto **wjb-website-app**.
2. No menu da esquerda, clique em **SQL Editor** → **New query**.
3. Abra no computador o arquivo `scripts/wjb-ai/producao/auditoria-somente-leitura.sql`, copie **todo** o conteúdo e cole no editor.
4. Clique em **Run**. Nas primeiras linhas do resultado (seção `identificacao`) deve aparecer `sessao_somente_leitura` com o valor `on`. Se aparecer `off`, **pare** e avise.
   - O script começa com uma trava do próprio Postgres que **recusa qualquer alteração**. Ele só conta registros e confere estrutura, sem mostrar nome, e-mail ou documento.
5. No resultado, clique em **Export → CSV** e guarde o arquivo.
6. Envie o arquivo para a equipe técnica por um canal privado (não precisa colar o conteúdo no chat).
7. Ainda no painel, **só olhando, sem clicar em restaurar**:
   - **Database → Backups:** anote as datas dos backups listados e se aparece "Point in Time Recovery";
   - **Settings → Billing:** anote o plano (Free ou Pro).
8. Envie o chamado da seção 2 em **Support → New ticket**.

## 2. Chamado ao Supabase (revisado)
Revisão em relação à 10F: pedido explícito de **preservação** dos backups antes de qualquer investigação, e pergunta direta sobre pausa por inatividade (o projeto já foi pausado no plano gratuito em 29/09).

> **Subject:** Urgent: please preserve backups - possible data loss on project hlyukumgyzswfndlzwcf (2026-10-12 20:00 UTC to 2026-10-13 17:49 UTC)
>
> Hello, Supabase team.
>
> **First request: please preserve any backup or point-in-time position of project `hlyukumgyzswfndlzwcf` (sa-east-1) taken before 2026-10-12 20:00 UTC, and do not let it expire while we investigate.**
>
> What we observed (we did not run any migration, DROP or restore in this period):
> - Up to 2026-10-12 20:00 UTC, a daily job that reads `public.obligations` succeeded.
> - From 2026-10-13 17:49 UTC, the same job failed every day; from at least 2026-11-10 the API returned `PGRST205` (table not found) for `public.obligations`.
> - Around 2026-11-20/22, the API returned `PGRST205` for every `public` table and Auth reported 0 users.
> - On 2026-11-26 the tables are visible again, but we do not know whether the data is the original one.
>
> Questions:
> 1. Was the project paused, restored, reset or migrated by the platform in this window (including pause for inactivity on the free plan)? Was there any action from our account? If possible, which actor.
> 2. Does any backup or PITR position before 2026-10-12 20:00 UTC exist? Until when will it be kept?
> 3. How can we restore it **into a new, separate project** (never over the current one)?
> 4. Can you share the project audit log for 2026-10-12 to 2026-10-14 and 2026-11-19 to 2026-11-26?
>
> We will not restore anything over the current project before your answer. Thank you.

## 3. Critérios de validação do resultado
O analisador `node scripts/wjb-ai/producao/analisar-auditoria.mjs <arquivo.csv>` aplica os critérios da Fase 10E: OK, ATENÇÃO ou CRÍTICO por item, e o caminho A (dados íntegros), B/C (recuperar de backup em projeto separado) ou D (recadastrar). Referência conhecida em 24/09: 1 conta, 2 empresas, 6 obrigações. Tabela existir **não** conta como dado recuperado.

## 4. Alertas das rotinas críticas: podem ser publicados separadamente?
**Sim.** A branch `hotfix/alertas-rotinas` (a partir da `main`, `a6f18c3c`) leva só:
- os workflows `lembretes-obrigacoes.yml` (com o job de alerta) e `monitoramento-producao.yml`;
- os scripts `alerta-rotina.sh` e `monitorar.sh`, somente leitura.

Não leva migration nem código da aplicação, e não muda o site. `issues: write` fica só no job de alerta, que não recebe segredo. **Não publicada**: não faz parte da operação autorizada (só os dois hotfixes). Publicar exige autorização. Depois disso:
- a rotina de lembretes passa a avisar a falha no dia seguinte, em vez de 44 dias depois;
- o monitoramento roda às 09:00 e às 18:00 de Brasília.
