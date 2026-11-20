# 19 - Incidente: banco de produção sem subir (20/11/2026)

**Projeto:** `wjb-website-app` (ref `hlyukumgyzswfndlzwcf`), sa-east-1, compute NANO, organização Pro.
**Investigação:** somente leitura pelo painel do Supabase (status, métricas, logs do Postgres, backups) e página pública de status. **Nada foi alterado.**

## 1. Evidências
| Observação | Valor |
| --- | --- |
| Status do projeto | "Coming up..." / "Checking..." durante ~1 h de observação, sem mudar |
| Métricas | CPU 2%, RAM 12%, disco 10%; **conexões "Unavailable"**; SQL Editor, Table Editor, Database e Authentication desabilitados no painel |
| Requisições 24 h | 971, **6,5% de sucesso**; Postgres com **854 erros** e crescendo (816 -> 834 -> 854) |
| Distribuição | erros do Postgres constantes ao longo das 24 h (desde pelo menos 19/11 às 17h) - **antes** da contratação do Pro (fatura de 20/11) |
| Auth, Storage, Realtime, API | atividade só na última hora (serviços tentando voltar) |
| Backups | **"No backups yet"** - nenhum backup agendado existe para o projeto |
| status.supabase.com | "All systems operational", sem incidente listado para sa-east-1 |

### Mensagens nos logs do Postgres (repetidas a cada poucos segundos)
```text
FATAL  password authentication failed for user "supabase_admin"
       User "supabase_admin" has no password assigned.
       Connection matched file "/etc/postgresql/pg_hba.conf" line 97: "host all all ::0/0 scram-sha-256"
FATAL  password authentication failed for user "postgres"
       User "postgres" has no password assigned. (mesma regra do pg_hba)
ERROR  relation "realtime.subscription" does not exist
```

## 2. O que as evidências mostram
- Os **papéis internos do próprio Supabase** (`supabase_admin`, `postgres`) estão **sem senha** no banco, e o esquema interno do Realtime está incompleto. Os serviços da plataforma não conseguem se conectar, por isso o projeto não sai de "Coming up".
- **Nenhuma migration do projeto altera papéis, senhas ou o esquema `realtime`** (verificado por busca nas 23 migrations). O problema não vem do código da WJB.
- O problema já existia antes da troca para o Pro, então a contratação **não** é a causa. A troca de plano provavelmente apenas fez a plataforma tentar subir o projeto de novo.

## 3. Hipótese (não confirmada)
Falha na restauração/reativação do projeto depois de uma pausa por inatividade (já ocorreu em 29/09 e 10/11 no plano gratuito), deixando os papéis internos sem senha. **Só o suporte do Supabase confirma e corrige**, porque `supabase_admin` é gerenciado pela plataforma e o SQL Editor está indisponível.

## 4. Impacto na WJB agora
- Login do Portal e do Admin, gravação de leads e lembretes de obrigações dependem do banco: **indisponíveis**.
- Site comercial: no ar; formulários caem no fallback do WhatsApp (comportamento já previsto desde 23/09).
- **Risco de dados:** sem backup. Os dados atuais (conta da CEO, empresas, obrigações, leads) existem só nesse banco.

## 5. Ações seguras recomendadas
1. **Abrir chamado no suporte do Supabase agora** (painel > ícone "?" > Contact support; o Pro inclui suporte por e-mail). Severidade: produção indisponível. Texto sugerido abaixo.
2. **Não** clicar em Restart, Pause, Resize (Nano -> Micro), Restore ou "Reset database password" até o suporte responder: qualquer uma dessas ações pode agir sobre um banco em estado inconsistente.
3. Pedir ao suporte, quando o projeto voltar: confirmar que os dados estão íntegros e que os backups diários passaram a rodar.
4. Assim que estiver Healthy: conferir login, Portal e gravação de lead; fazer um backup manual (pg_dump) antes de qualquer outra mudança.

### Texto sugerido para o chamado (revisar antes de enviar)
> Project ref: hlyukumgyzswfndlzwcf (wjb-website-app, sa-east-1, Pro plan).
> The project has been stuck in "Coming up" and the database is unreachable (connections "Unavailable", SQL Editor disabled). Postgres logs repeat every few seconds:
> `FATAL: password authentication failed for user "supabase_admin" - User "supabase_admin" has no password assigned (pg_hba.conf line 97)`, the same for user `postgres`, and `ERROR: relation "realtime.subscription" does not exist`.
> Errors started at least on Nov 19 ~5pm (before we upgraded to Pro on Nov 20). The project was previously paused due to inactivity on the free plan. We have no backups yet. We have not run any manual action. Please restore the internal role credentials / bring the project up without data loss, and confirm data integrity. This is our production database.

## 6. Próximo passo meu
Nenhuma ação na produção. A homologação é um projeto separado e não depende deste incidente.
