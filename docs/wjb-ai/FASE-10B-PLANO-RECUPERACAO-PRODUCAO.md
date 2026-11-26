# Fase 10B - Plano de recuperação do banco de produção

**Projeto:** `wjb-website-app`.
**Este plano não executa nada.** Nenhuma migration, restore, reset, reinício, criação de usuário ou SQL de alteração na produção sem decisão documentada da WJB.

## 1. Situação (com evidência e data)
| Data | Verificação | Resultado |
| --- | --- | --- |
| 20/11 | painel (doc 19) | papéis internos sem senha; "No backups yet" |
| 22/11 | API com chave de serviço, no servidor (doc 54) | Auth 200; **nenhuma tabela** visível (`PGRST205`); **0 usuários** no Auth |
| 26/11 (Fase 10B) | só com a chave **pública** (publicável), no servidor | Auth 200; `profiles` e `tenants` respondem `[]` **sem** `PGRST205`: a API **voltou a enxergar as tabelas** |
| 26/11 | site | `/`, `/contato`, `/planos` com 200 |

**Leitura:** a resposta `[]` com chave pública é a esperada para uma tabela que existe. A RLS esconde as linhas de quem não está logado, então essa resposta **não diz se há dados**.

Três hipóteses continuam abertas, e só o painel ou o suporte separam:
- o suporte recuperou o banco;
- alguém recriou as tabelas vazias;
- o esquema só voltou a ser carregado.

**Não concluir que os dados voltaram, nem que foram perdidos.**

Nesta fase não usei a chave de serviço. Por isso a contagem de usuários de 22/11 não foi repetida. Repetir essa contagem exige autorização.

## 2. Inspeções somente leitura (WJB, no painel)
- [ ] **Table Editor:** contar as linhas de `profiles`, `tenants`, `obligations`, `leads`, `documents` (só contagem).
- [ ] **Authentication > Users:** quantos usuários? A conta da CEO existe?
- [ ] **Database > Backups:** há backup diário ou PITR? Desde quando?
- [ ] **Database > Migrations** (ou `supabase_migrations.schema_migrations`): quais estão registradas? Deveria ir até a **0023** (as 0024-0035 nunca foram aplicadas em produção).
- [ ] **Logs do Postgres:** erros desde 20/11. Não exportar consultas, que podem conter dados pessoais.
- [ ] **Billing:** plano ativo (Pro?) e data da fatura.
- [ ] **Storage:** o bucket de documentos existe? Há arquivos?

## 3. Perguntas ao suporte do Supabase
1. Número e status do chamado. Qual foi a causa do incidente de 19-20/11 (papéis internos sem senha)?
2. O banco atual é o **mesmo** de antes do incidente, ou foi recriado ou restaurado? De quando são os dados?
3. Existe snapshot interno ou PITR de antes de 19/11/2026? É possível restaurar **num projeto novo**, sem sobrescrever o atual?
4. Os usuários do Auth (schema `auth`) foram preservados? Se não, há como recuperá-los?
5. Houve alguma ação no projeto depois de 20/11 (restore, reset, migrations) e quem a executou?
6. O Storage foi afetado?

## 4. Recuperação (opções; nenhuma executada)
| Situação confirmada | Opção | Cuidados |
| --- | --- | --- |
| Os dados estão no banco | nenhuma recuperação; conferir as contagens contra a última referência conhecida (1 conta, 2 empresas, 6 obrigações, 0 leads em 24/09; leads posteriores no e-mail do Resend) e o login da CEO | conferir antes de liberar o uso |
| Há backup ou PITR | restaurar **num projeto separado**, conferir contagens, login e RLS (roteiro de `03-backup-restauracao.mjs` e `run.sh`); só então decidir a troca | nunca restaurar por cima da produção sem um teste |
| Não há backup | reconstrução: migrations 0001-0023 num banco vazio, conta da CEO, reimportar empresas do G-Click por CNPJ (existe desde 01/10), reenviar convites; recuperar leads dos e-mails do Resend | documentos enviados ao Storage e obrigações manuais só voltam com backup |

## 5. Inventário de impacto
| Dado | Onde mais existe | Recuperável sem backup? |
| --- | --- | --- |
| Usuários (login) | nenhum | não; convidar de novo |
| Empresas | G-Click (cadastro e CNPJ) | sim, pela importação |
| Obrigações sincronizadas | G-Click | sim, por sincronização |
| Obrigações manuais | nenhum | não |
| Documentos (Storage) | e-mail ou arquivos da equipe, se houver | parcialmente |
| Leads | e-mail do Resend | parcialmente |
| Trilha de auditoria | nenhum | não |

## 6. Bloqueios decorrentes
As etapas B, D, E e F do plano de publicação (doc 51) esperam:
- a confirmação do estado do banco;
- **um backup testado** em projeto separado.

A etapa A (hotfix do Next.js) não toca no banco.
