# Fase 10E - Banco de produção: evidências, critérios e backups

**Data:** 26/11/2026. **Nada foi feito no banco de produção:**
- nenhuma consulta com credencial privilegiada;
- nenhuma migration;
- nenhuma alteração;
- nenhum restore;
- a chave de serviço não foi usada.

## 1. Evidência nova: linha do tempo do incidente
Fontes, todas sem dado pessoal:
- histórico da rotina diária de lembretes no GitHub Actions (`lembretes-obrigacoes.yml`), que chama a produção uma vez por dia;
- logs da aplicação no servidor, das versões ainda guardadas, lidos só com contagens e com e-mails, números e tokens mascarados.

| Data (UTC) | Evidência | Leitura |
| --- | --- | --- |
| 01/10 a 12/10 | a rotina responde `{"ok":true,...}` todos os dias (a última, 12/10 20:00, com `sent: 0`) | a tabela `obligations` existia e era consultável |
| **13/10 17:49** | 1ª falha: `500 {"error":"falha ao buscar obrigações"}` | **o problema começa entre 12/10 20:00 e 13/10 17:49** |
| 13/10 a 25/11 | a rotina falha **todos os dias** com a mesma resposta | a consulta falha por 44 dias seguidos |
| 10/11 a 25/11 | os logs da aplicação mostram a causa: `PGRST205 Could not find the table 'public.obligations'` (os logs anteriores a 10/11 não existem mais no servidor) | a tabela **não existia** para a API |
| 20/11 | painel: papéis internos sem senha; "No backups yet" (doc 19) | — |
| 22/11 | Auth 200, nenhuma tabela, 0 usuários (doc 54) | — |
| **26/11 19:53** | a rotina volta a responder `{"ok":true,"sent":0,"skipped":0}` | a tabela **existe de novo**; o resultado não diz se há linhas |

**O que isso muda:**
- o incidente é **cerca de 6 semanas mais antigo** do que se sabia (19 e 20/11). Para a pergunta ao suporte sobre backup ou PITR, a data que importa é **antes de 12/10/2026 20:00 UTC**;
- mesmo num plano pago, a retenção padrão de backups diários e de PITR costuma ser de dias, não de semanas. A recuperação provavelmente depende de **cópia interna do suporte**, se existir;
- a falha diária ficou 44 dias sem alarme. A rotina falhava no GitHub, mas ninguém foi avisado (seção 5).

## 2. O que continua sem prova
A existência das tabelas **não** prova integridade nem recuperação. Hoje se sabe só que:
- o Auth responde;
- as tabelas existem para a API;
- a consulta de obrigações funciona.

Não se sabe quantas linhas há, se os usuários voltaram, nem de quando são os dados. **Só o script de auditoria responde isso.**

## 3. Critérios objetivos de análise
O resultado do `scripts/wjb-ai/producao/auditoria-somente-leitura.sql`, exportado como CSV pelo SQL Editor, é analisado por:

```sh
node scripts/wjb-ai/producao/analisar-auditoria.mjs resultado.csv
```

O analisador classifica cada item como **OK**, **ATENÇÃO**, **CRÍTICO** ou **AUSENTE** e sugere o caminho do plano de recuperação. Ele está testado com o resultado real da homologação e com casos sintéticos (`src/tests/unit/producao-auditoria.test.ts`).

| Nível | Critérios |
| --- | --- |
| **CRÍTICO, segurança** (caminho **D**) | tabela sem RLS; política aberta (`true`) para anônimo; guarda de colunas privilegiadas (0022) ausente; funções de acesso ausentes; bucket `documents` público ou inexistente; super admin sem MFA; conta de teste na equipe; nenhum super admin |
| **CRÍTICO, dados** (caminho **B ou C**) | 0 usuários no Auth; `profiles` e `tenants` vazios |
| **ATENÇÃO** | contagens abaixo da referência de 24/09 (1 conta, 2 empresas, 6 obrigações); qualquer órfão ou duplicado; número de tabelas diferente de 13; função SECURITY DEFINER sem `search_path`; índice inválido; marcador de migration (0016, 0017, 0020, 0022, 0023) ausente; tabela da WJB AI na produção; menos usuários com MFA que perfis de equipe |
| **AUSENTE** | item que não veio no resultado: o caminho fica INCOMPLETO |
| **Inválido** | a primeira linha do script (somente leitura) não foi aplicada |

**Prioridade:** um problema de segurança vence um de dados. O caminho D vem antes de qualquer recuperação.

## 4. Checklist de backups e PITR (painel do Supabase, responsável da WJB)
- [ ] **Billing:** qual o plano? (O gratuito não tem backup acessível pelo painel.)
- [ ] **Database → Backups:** há backups diários? Qual o mais antigo disponível? Anotar só as datas.
- [ ] **PITR:** está ligado? Até quando dá para voltar?
- [ ] Algum backup ou ponto de PITR é **anterior a 12/10/2026 20:00 UTC**?
- [ ] **Suporte (chamado):** existe cópia interna anterior a 12/10? Pode ser restaurada num **projeto novo**, sem sobrescrever o atual? Qual foi a causa do sumiço das tabelas em 12-13/10 e da volta em 26/11? Alguém executou restore, reset ou migration?
- [ ] **Authentication → Users:** quantos usuários existem e de quando são (data do mais antigo).
- [ ] **Storage:** o bucket `documents` existe? Quantos arquivos?
- [ ] Depois da decisão: ligar backup diário (plano pago) e **testar uma restauração** num projeto separado.

## 5. Recuperação em ambiente isolado (procedimento)
Nada disso é executado sem autorização específica.

1. **Projeto novo e separado** no Supabase (ex.: `wjb-website-app-restore`), sem nenhuma ligação com o site.
2. O suporte ou o painel restaura o backup ou PITR **nesse projeto**. Nunca no de produção.
3. Rodar o script de auditoria nele e analisar com o `analisar-auditoria.mjs`.
4. Conferir o isolamento entre empresas **no projeto restaurado**: dois usuários de empresas diferentes, cada um só vê a própria empresa. O roteiro da homologação (`run.sh` e os testes de API) serve de modelo.
5. Comparar com as fontes externas: empresas e obrigações do G-Click; leads nos e-mails do Resend.
6. Decisão documentada: trocar a aplicação para o projeto restaurado (variáveis na Hostinger) **ou** copiar dados pontuais.
7. **Rollback:** voltar as variáveis da Hostinger. O projeto antigo fica intocado por, no mínimo, 30 dias.

## 6. Alarme que faltou
A rotina de lembretes falhou por 44 dias sem que ninguém soubesse. Recomendações, que dependem de autorização:
- notificação de falha de workflow por e-mail no GitHub para a pessoa responsável;
- o `scripts/wjb-ai/producao/monitorar.sh` rodando periodicamente.
