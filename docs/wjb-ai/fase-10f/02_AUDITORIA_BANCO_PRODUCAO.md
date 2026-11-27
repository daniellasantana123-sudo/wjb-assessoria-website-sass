# Fase 10F - Auditoria do banco de produção (P0)

**Situação:** aguardando a WJB rodar o script. **Nada foi executado no banco de produção** (nem leitura com a chave de serviço, que não foi usada). As tabelas voltarem a responder **não prova** que os dados voltaram.

## 1. O que a WJB precisa fazer (cerca de 15 minutos)
1. Supabase → projeto `wjb-website-app` → **SQL Editor** → colar o conteúdo de `scripts/wjb-ai/producao/auditoria-somente-leitura.sql` → **Run**.
   - O script começa com `set default_transaction_read_only = on`: o próprio Postgres recusa qualquer escrita. Testado na homologação.
   - Resultado: uma tabela `secao | item | valor`, só **contagens e datas**, sem dado pessoal.
2. **Export → CSV** e enviar o arquivo (não colar no chat se tiver qualquer valor inesperado).
3. Do nosso lado: `node scripts/wjb-ai/producao/analisar-auditoria.mjs <arquivo.csv>` classifica cada item em OK / ATENÇÃO / CRÍTICO e indica o caminho de recuperação:

| Caminho | Quando | O que fazer |
| --- | --- | --- |
| A | dados presentes e coerentes com a referência (1 conta, 2 empresas, 6 obrigações em 24/09) | só monitorar |
| B / C | dados parciais ou ausentes, com backup/PITR anterior a 12/10 | recuperar num **projeto separado** e comparar antes de qualquer decisão |
| D | só dados de teste ou banco vazio, sem backup | recadastrar a partir do G-Click e da WJB |

## 2. O que o script cobre
- **Usuários:** Auth (total, confirmados, login nos últimos 30 dias, banidos, com MFA, primeira e última criação) e equipe (super admin, contador, atendimento, super admin sem MFA, contas com e-mail de teste).
- **Registros:** empresas, vínculos, obrigações, documentos, chamados, notificações, leads, vínculos com o G-Click.
- **Integridade referencial:** perfis sem usuário e o contrário, empresas sem membro, vínculos, obrigações, documentos, chamados e notificações órfãos, documento sem arquivo no Storage.
- **Schema:** tabelas, funções, `security definer` sem `search_path`, gatilhos, restrições, índices (inclusive inválidos), extensões.
- **RLS:** tabelas sem RLS, com RLS e sem política, políticas abertas para `anon`, guarda de colunas privilegiadas (0022), funções de acesso.
- **Migrations:** histórico e marcos 0016, 0017, 0020, 0022 e 0023.
- **Storage:** buckets, arquivos por bucket, tamanho e políticas.

**Fora do alcance do SQL** (painel ou suporte): backups diários, PITR, logs do Postgres e da API anteriores a 7 dias. Ver seção 4.

## 3. Linha do tempo (evidência da Fase 10E)
| Momento (UTC) | Fonte | Fato |
| --- | --- | --- |
| até 12/10 20:00 | GitHub Actions (`lembretes-obrigacoes.yml`) | rotina diária com sucesso |
| 13/10 17:49 em diante | GitHub Actions | `500 falha ao buscar obrigações`, todos os dias |
| 10/11 a 25/11 | log da aplicação na Hostinger | `PGRST205`: tabela `public.obligations` não existe |
| 26/11 19:53 | GitHub Actions | sucesso de novo (`sent: 0, skipped: 0`) |

**Janela do incidente:** 12/10/2026 20:00 UTC a 13/10/2026 17:49 UTC. Um backup útil tem de ser **anterior a 12/10 20:00 UTC**.

## 4. Chamado ao suporte do Supabase (texto pronto)
Enviar pelo painel (**Support → New ticket**, categoria *Database* / *Data loss*), pela conta dona do projeto. Não incluir chave nem senha.

> **Assunto:** Possible data loss on project hlyukumgyzswfndlzwcf between 2026-10-12 20:00 UTC and 2026-10-13 17:49 UTC
>
> Hello, Supabase team.
>
> Our project `hlyukumgyzswfndlzwcf` (region sa-east-1) seems to have lost its `public` schema tables in the window below. We did not run any migration, DROP or restore in this period.
>
> - Up to 2026-10-12 20:00 UTC: a daily job that reads `public.obligations` succeeded.
> - From 2026-10-13 17:49 UTC: the same job failed every day; the API returned `PGRST205` (table not found in the schema cache) for `public.obligations` from at least 2026-11-10.
> - Around 2026-11-20/22: the API returned `PGRST205` for every `public` table, and Auth reported 0 users.
> - On 2026-11-26 the tables are visible again through the API, but we do not know whether the data is the original one.
>
> Could you please:
> 1. Tell us what happened to the project in this window (pause/restore, maintenance, schema reset, incident on your side, or an action taken from our account, with the actor if available).
> 2. Confirm whether a daily backup or a point-in-time recovery position **before 2026-10-12 20:00 UTC** still exists, and until when it will be kept.
> 3. If it exists, keep it from expiring while we investigate, and explain how to restore it **into a new, separate project** (not over the current one).
> 4. Share any audit log of the project (dashboard, API or SQL actions) for 2026-10-12 to 2026-10-14 and 2026-11-19 to 2026-11-26.
>
> We will not restore anything over the current project before your answer. Thank you.

**Perguntas complementares no painel**, antes de responder ao suporte (só olhar, não clicar em restaurar):
- **Database → Backups:** quantos backups diários aparecem e de que datas; se o PITR está ligado e qual o período coberto.
- **Settings → General / Billing:** plano atual. No gratuito não há backup diário acessível pelo painel nem PITR: se for o caso, o chamado é a única via.
- **Logs → Postgres / API:** até onde os registros voltam (normalmente poucos dias).

## 5. Recuperação isolada (só com autorização)
Procedimento completo na Fase 10E (`docs/wjb-ai/fase-10e/01_AUDITORIA_BANCO_PRODUCAO.md`, seções 4 e 5). Regras:
1. Restaurar **sempre num projeto novo**, nunca sobre `hlyukumgyzswfndlzwcf`.
2. Comparar contagens e chaves com o resultado da auditoria antes de qualquer cópia.
3. Copiar de volta só com autorização expressa, por tabela, com backup do estado atual antes.

## 6. Alertas das rotinas críticas (implementado)
A rotina de lembretes falhou **44 dias seguidos sem aviso**. Agora:
- `scripts/ci/alerta-rotina.sh`: na falha, abre um issue "Falha na rotina: …" no GitHub (o GitHub avisa por e-mail quem acompanha o repositório), ou comenta no issue que já está aberto; quando a rotina volta, comenta e fecha. Só nome, resultado e link da execução: nenhum conteúdo de resposta ou segredo. `ALERTA_DRY_RUN=1` para testar (testado nos caminhos de falha e de sucesso).
- `lembretes-obrigacoes.yml`: job `alerta` depois da rotina (`permissions: issues: write`, `contents: read`).
- `monitoramento-producao.yml` (novo): `monitorar.sh` somente leitura às 09:00 e 18:00 de Brasília, com o mesmo alerta.

**Limites:**
- O GitHub só roda rotinas agendadas a partir da `main`: os alertas valem **depois do merge**. Não foi possível disparar o monitoramento manualmente antes disso (o GitHub recusa workflow fora da branch padrão).
- O CDN da Hostinger já bloqueou acesso automatizado. Se bloquear o servidor do GitHub, o monitoramento vai alertar por isso (o log mostra 403).
- Para o aviso chegar por e-mail, a pessoa responsável precisa **acompanhar** o repositório (*Watch*), com as notificações de e-mail ligadas na conta do GitHub.
